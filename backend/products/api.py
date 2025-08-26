from ninja import Router, File
from ninja.files import UploadedFile
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.shortcuts import get_object_or_404
import pandas as pd
import os
import uuid
import json
import csv
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Upload, Product, Scrape
from .utils import ingest_upload, ValidationError
from marketplace.models import Marketplace, Store
from vendor.models import Vendor, VendorPrice
from django.db import models

# Scraping imports
import asyncio
import aiohttp
import re
import random
import logging
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from django.db import transaction
from django.db.models import Q
import pytz

router = Router()

# Configure logging
logger = logging.getLogger(__name__)

# Scraping configuration constants
MAX_CONCURRENT_REQUESTS = 5
BATCH_SIZE = 5
TIMEOUT = aiohttp.ClientTimeout(total=45)
RETRY_LIMIT = 1

# Pre-compiled regex patterns for performance
QUANTITY_PATTERN = re.compile(
    r'"NumberValidation","minValue":"(\d+)","maxValue":"(\d+)"'
)
HANDLING_PATTERN = re.compile(
    r'(?<="textSpans":\[\{"_type":"TextSpan","text":"Will usually ship within )[^"]*(?=")'
)
PRICE_CLEAN_PATTERN = re.compile(r'[^\d.]')
STOCK_EXTRACT_PATTERN = re.compile(r'\d+')

# CSS selectors for eBay page elements
SELECTORS = {
    'title': '.x-item-title__mainTitle span',
    'status_message': '.ux-layout-section__textual-display--statusMessage span',
    'price': '.x-price-primary span',
    'seller_away': '.x-alert--ALERT_SA div.ux-message',
    'shipping': '.ux-labels-values--shipping .ux-labels-values__values-content div:nth-of-type(1)',
    'stock': 'div.x-quantity__availability',
    'message': 'div.ux-message__content',
    'select_boxes': 'button.btn--truncated',
    'breadcrumb': '.breadcrumbs li'
}

# Realistic User-Agent strings for rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
]

# Scraping Helper Functions
def validate_ebay_item_number(vendor_sku: str) -> tuple[bool, str]:
    """Validate eBay item number format."""
    try:
        item_num = str(vendor_sku).split('.')[0]
        
        if not item_num.isdigit():
            return False, "Not numeric"
        
        if len(item_num) < 10 or len(item_num) > 12:
            return False, f"Invalid length: {len(item_num)}"
            
        return True, "Valid"
    except Exception as e:
        logger.warning(f"Error validating eBay item number {vendor_sku}: {e}")
        return False, "Invalid format"

def parse_price_to_decimal(price_text: str) -> Optional[Decimal]:
    """Parse price text to decimal with 2 decimal places."""
    if not price_text:
        return None
    
    try:
        clean_price = PRICE_CLEAN_PATTERN.sub('', str(price_text))
        if clean_price:
            return Decimal(clean_price).quantize(Decimal('0.01'))
        return None
    except (InvalidOperation, ValueError) as e:
        logger.warning(f"Error parsing price '{price_text}': {e}")
        return None

def parse_stock_to_int(stock_text: str) -> Optional[int]:
    """Parse stock text to integer."""
    if not stock_text:
        return None
    
    try:
        numbers = STOCK_EXTRACT_PATTERN.findall(str(stock_text))
        if numbers:
            return int(numbers[0])
        return None
    except (ValueError, IndexError) as e:
        logger.warning(f"Error parsing stock '{stock_text}': {e}")
        return None

def generate_error_log_filename(session_id: str) -> str:
    """Generate filename for error logs."""
    return f"scrapping_logs_{session_id}.xlsx"

def create_error_log_excel(results: List[Dict[str, Any]], session_id: str) -> str:
    """Create Excel error log file."""
    try:
        filename = generate_error_log_filename(session_id)
        filepath = os.path.join("uploads", filename)
        
        # Prepare data for Excel
        excel_data = []
        for result in results:
            try:
                product_id = result.get('product_id')
                if product_id:
                    product = Product.objects.select_related('vendor', 'marketplace', 'store', 'upload').get(id=product_id)
                    
                    # Determine status
                    status = "SUCCESS" if result.get('success') else "FAILED"
                    response_text = str(result) if result.get('success') else result.get('error_status', 'Unknown error')
                    
                    excel_data.append({
                        'Vendor Name': product.vendor.name,
                        'Vendor ID': product.vendor_sku,
                        'Is Variation': 'Yes' if product.variation_id else 'No',
                        'Variation ID': product.variation_id,
                        'Marketplace Name': product.marketplace.name,
                        'Store Name': product.store.name,
                        'Marketplace Parent SKU': product.marketplace_parent_sku,
                        'Marketplace Child SKU': product.marketplace_child_sku,
                        'Marketplace ID': '',  # Not stored in our model
                        'Product ID': product.id,
                        'STATUS': status,
                        'Response from scrapper': response_text
                    })
            except Product.DoesNotExist:
                logger.error(f"Product {product_id} not found for error log")
            except Exception as e:
                logger.error(f"Error processing product {product_id} for error log: {e}")
        
        # Create DataFrame and save to Excel
        df = pd.DataFrame(excel_data)
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        logger.info(f"Error log created: {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error creating error log: {e}")
        return ""

@router.post("/upload/")
def upload_file(request, file: UploadedFile = File(...)):
    """
    Handle file upload for product mapping with comprehensive validation
    """
    try:
        # Validate file type
        allowed_extensions = ['.csv', '.xlsx', '.xls']
        file_extension = os.path.splitext(file.name)[1].lower()
        
        if file_extension not in allowed_extensions:
            return {
                "success": False, 
                "error": "Invalid file type. Please upload CSV or Excel files only.",
                "errorType": "INVALID_FILE_TYPE"
            }
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        uploads_dir = os.path.join("uploads")
        file_path = os.path.join(uploads_dir, unique_filename)
        
        # Ensure uploads directory exists
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Save file
        with open(file_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        
        # Create Upload record
        upload = Upload.objects.create(
            original_name=file.name,
            stored_key=file_path,
            expires_at=timezone.now() + timedelta(days=30)  # Keep for 30 days
        )
        
        # Get basic file info for response
        try:
            if file_extension in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                df = pd.read_csv(file_path)
            
            items_uploaded = len(df)
            
            # Get vendor and marketplace names from first row
            vendor_name = df['Vendor Name'].iloc[0] if len(df) > 0 and 'Vendor Name' in df.columns else "Unknown"
            marketplace_name = df['Marketplace Name'].iloc[0] if len(df) > 0 and 'Marketplace Name' in df.columns else "Unknown"
            
        except Exception as e:
            # Clean up uploaded file if we can't parse it
            if os.path.exists(file_path):
                os.remove(file_path)
            upload.delete()
            return {
                "success": False, 
                "error": f"File parsing error: {str(e)}",
                "errorType": "FILE_PARSING_ERROR"
            }
        
        # Process the file with comprehensive validation
        try:
            processed_count = ingest_upload(upload.id)
            status = "uploaded"  # File uploaded successfully, but scraping not done yet
            error_logs = "No errors"
            items_added = processed_count
            
        except ValidationError as e:
            # Clean up uploaded file and database record for validation failures
            if os.path.exists(file_path):
                os.remove(file_path)
            upload.delete()
            
            # Return structured error response for frontend
            return {
                "success": False,
                "error": str(e),
                "errorType": e.error_type,
                "details": {
                    "fileName": file.name,
                    "itemsFound": items_uploaded,
                    "vendorName": vendor_name,
                    "marketplace": marketplace_name
                }
            }
            
        except Exception as e:
            # For unexpected errors, keep the file for debugging but mark as failed
            status = "failed"
            error_logs = str(e)
            items_added = 0
        
        # Store the status information for future requests (preserve status)
        status_info = {
            'status': status,
            'vendorName': vendor_name,
            'marketplace': marketplace_name,
            'itemsUploaded': items_uploaded,
            'itemsAdded': items_added,
            'errorLogs': error_logs
        }
        upload.note = json.dumps(status_info)
        upload.save()
        
        return {
            "success": True,
            "upload_id": upload.id,
            "date": timezone.now().strftime("%Y-%m-%d"),
            "userName": request.user.username if hasattr(request, 'user') and request.user.is_authenticated else "System",
            "vendorName": vendor_name,
            "marketplace": marketplace_name,
            "itemsUploaded": items_uploaded,
            "itemsAdded": items_added,
            "status": status,
            "errorLogs": error_logs
        }
        
    except Exception as e:
        return {
            "success": False, 
            "error": f"Upload failed: {str(e)}",
            "errorType": "UPLOAD_ERROR"
        }

@router.get("/uploads/")
def get_uploads(request):
    """
    Get all upload records with preserved status
    """
    try:
        uploads = Upload.objects.all().order_by('-id')[:50]  # Limit to last 50 uploads
        
        results = []
        for upload in uploads:
            try:
                # Check if we already have stored status information
                stored_info = None
                if upload.note:
                    try:
                        stored_info = json.loads(upload.note)
                        # Validate it's our status info format
                        if not isinstance(stored_info, dict) or 'status' not in stored_info:
                            stored_info = None
                    except (json.JSONDecodeError, TypeError):
                        stored_info = None
                
                # If we have stored info, use it (preserve status)
                if stored_info:
                    vendor_name = stored_info.get('vendorName', 'Unknown')
                    marketplace_name = stored_info.get('marketplace', 'Unknown')
                    items_uploaded = stored_info.get('itemsUploaded', 0)
                    items_added = stored_info.get('itemsAdded', 0)
                    status = stored_info.get('status', 'pending')
                    error_logs = stored_info.get('errorLogs', 'No errors')
                else:
                    # First time processing - calculate status and store it
                    # Try to read the file to get details
                    if upload.stored_key.endswith(('.xlsx', '.xls')):
                        df = pd.read_excel(upload.stored_key)
                    else:
                        df = pd.read_csv(upload.stored_key)
                    
                    items_uploaded = len(df)
                    
                    # Get vendor and marketplace names from first row
                    vendor_name = df['Vendor Name'].iloc[0] if len(df) > 0 and 'Vendor Name' in df.columns else "Unknown"
                    marketplace_name = df['Marketplace Name'].iloc[0] if len(df) > 0 and 'Marketplace Name' in df.columns else "Unknown"
                    
                    # Try to determine status by checking if products were created
                    try:
                        vendor = Vendor.objects.filter(code=vendor_name).first()
                        marketplace = Marketplace.objects.filter(code=marketplace_name).first()
                        
                        if vendor and marketplace:
                            # Count products created from this upload (approximate)
                            items_added = Product.objects.filter(vendor=vendor, marketplace=marketplace).count()
                            status = "completed" if items_added > 0 else "pending"
                            error_logs = "No errors"
                        else:
                            items_added = 0
                            status = "failed"
                            error_logs = "Vendor or marketplace not found"
                            
                    except Exception as e:
                        items_added = 0
                        status = "failed"
                        error_logs = f"Status check error: {str(e)}"
                    
                    # Store the calculated information for future requests
                    status_info = {
                        'status': status,
                        'vendorName': vendor_name,
                        'marketplace': marketplace_name,
                        'itemsUploaded': items_uploaded,
                        'itemsAdded': items_added,
                        'errorLogs': error_logs
                    }
                    
                    # Save to upload note field
                    upload.note = json.dumps(status_info)
                    upload.save()
                    
            except Exception as e:
                # Fallback for any errors
                vendor_name = "Unknown"
                marketplace_name = "Unknown"
                items_uploaded = 0
                items_added = 0
                status = "failed"
                error_logs = f"File read error: {str(e)}"
            
            results.append({
                "id": upload.id,
                "date": upload.expires_at.strftime("%Y-%m-%d"),
                "userName": "System",  # You can add user tracking later
                "vendorName": vendor_name,
                "marketplace": marketplace_name,
                "itemsUploaded": items_uploaded,
                "itemsAdded": items_added,
                "status": status,
                "errorLogs": error_logs
            })
        
        return {"success": True, "uploads": results}
        
    except Exception as e:
        return {"success": False, "error": str(e), "uploads": []}

@router.delete("/upload/{upload_id}")
def delete_upload(request, upload_id: int):
    """
    Delete an upload and all products created by it
    """
    try:
        # Get the upload record
        try:
            upload = Upload.objects.get(id=upload_id)
        except Upload.DoesNotExist:
            return {
                "success": False,
                "error": "Upload not found",
                "errorType": "UPLOAD_NOT_FOUND"
            }
        
        deletion_summary = {
            "products_deleted": 0,
            "vendor_prices_deleted": 0,
            "file_deleted": False,
            "upload_deleted": False
        }
        
        errors = []
        
        # Get upload details for product identification
        try:
            # Read the file to get vendor/marketplace info
            if upload.stored_key.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(upload.stored_key)
            else:
                df = pd.read_csv(upload.stored_key)
            
            if len(df) > 0:
                # Find and delete products created by this upload
                from django.db.models import Q
                from marketplace.models import Store
                
                products_to_delete = []
                
                # Get exact product combinations from the uploaded file
                for index, row in df.iterrows():
                    vendor_name = str(row['Vendor Name']).strip()
                    marketplace_name = str(row['Marketplace Name']).strip()
                    store_name = str(row['Store Name']).strip()
                    marketplace_child_sku = str(row['Marketplace Child SKU']).strip()
                    vendor_sku = str(row['Vendor ID']).strip() if 'Vendor ID' in row else ''
                    
                    # Find the exact vendor, marketplace, and store
                    vendor = Vendor.objects.filter(
                        Q(code=vendor_name) | Q(name=vendor_name)
                    ).first()
                    
                    marketplace = Marketplace.objects.filter(
                        Q(code=marketplace_name) | Q(name=marketplace_name)
                    ).first()
                    
                    store = Store.objects.filter(
                        name=store_name,
                        marketplace=marketplace
                    ).first()
                    
                    if vendor and marketplace and store:
                        # Find the exact product that matches this row from the file
                        matching_product = Product.objects.filter(
                            vendor=vendor,
                            marketplace=marketplace,
                            store=store,
                            marketplace_child_sku=marketplace_child_sku,
                            vendor_sku=vendor_sku
                        ).first()
                        
                        if matching_product and matching_product not in products_to_delete:
                            products_to_delete.append(matching_product)
                
                # Delete VendorPrice records first (they reference products)
                from django.db import transaction
                
                with transaction.atomic():
                    vendor_prices_count = 0
                    products_count = 0
                    
                    for product in products_to_delete:
                        # Delete associated VendorPrice records
                        vendor_price_count = VendorPrice.objects.filter(product=product).count()
                        VendorPrice.objects.filter(product=product).delete()
                        vendor_prices_count += vendor_price_count
                    
                    # Delete the products
                    products_count = len(products_to_delete)
                    for product in products_to_delete:
                        product.delete()
                    
                    deletion_summary["products_deleted"] = products_count
                    deletion_summary["vendor_prices_deleted"] = vendor_prices_count
                    
        except Exception as e:
            errors.append(f"Error processing products: {str(e)}")
        
        # Delete the physical file
        try:
            if os.path.exists(upload.stored_key):
                os.remove(upload.stored_key)
                deletion_summary["file_deleted"] = True
            else:
                errors.append("Physical file not found or already deleted")
        except Exception as e:
            errors.append(f"Error deleting file: {str(e)}")
        
        # Delete the upload record
        try:
            upload.delete()
            deletion_summary["upload_deleted"] = True
        except Exception as e:
            errors.append(f"Error deleting upload record: {str(e)}")
        
        # Determine response based on success/failures
        if errors:
            return {
                "success": True,  # Partial success
                "message": "Upload deletion completed with some issues",
                "summary": deletion_summary,
                "warnings": errors,
                "partial": True
            }
        else:
            return {
                "success": True,
                "message": f"Upload deleted successfully. Removed {deletion_summary['products_deleted']} products and {deletion_summary['vendor_prices_deleted']} vendor prices.",
                "summary": deletion_summary,
                "partial": False
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to delete upload: {str(e)}",
            "errorType": "DELETE_ERROR"
        }

@router.post("/bulk-delete/")
def bulk_delete_products(request, file: UploadedFile = File(...)):
    """
    Handle bulk deletion of products based on CSV file with Child SKU and Store Name
    """
    try:
        # Validate file type
        allowed_extensions = ['.csv', '.xlsx', '.xls']
        file_extension = os.path.splitext(file.name)[1].lower()
        
        if file_extension not in allowed_extensions:
            return {
                "success": False, 
                "error": "Invalid file type. Please upload CSV or Excel files only.",
                "errorType": "INVALID_FILE_TYPE"
            }
        
        # Generate unique filename for temporary storage
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        uploads_dir = os.path.join("uploads")
        file_path = os.path.join(uploads_dir, unique_filename)
        
        # Ensure uploads directory exists
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Save file temporarily
        with open(file_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        
        try:
            # Read the file
            if file_extension in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                df = pd.read_csv(file_path)
            
            # Validate required columns - be flexible with column names
            possible_sku_columns = ['Child sku', 'child sku', 'Child SKU', 'child_sku']
            possible_store_columns = ['store name', 'Store name', 'Store Name', 'store_name']
            
            sku_column = None
            store_column = None
            
            for col in df.columns:
                if col in possible_sku_columns:
                    sku_column = col
                if col in possible_store_columns:
                    store_column = col
            
            if not sku_column or not store_column:
                return {
                    "success": False,
                    "error": f"Missing required columns. Expected: 'Child sku' and 'store name'. Found columns: {list(df.columns)}",
                    "errorType": "MISSING_COLUMNS"
                }
            
            # Check for empty data
            if df.empty:
                return {
                    "success": False,
                    "error": "File is empty or contains no data rows",
                    "errorType": "EMPTY_FILE"
                }
            
            deletion_summary = {
                "products_deleted": 0,
                "rows_processed": 0,
                "rows_not_found": 0
            }
            
            not_found_items = []
            
            # Process deletion within transaction
            with transaction.atomic():
                for index, row in df.iterrows():
                    child_sku = str(row[sku_column]).strip()
                    store_name = str(row[store_column]).strip()
                    
                    # Skip empty rows
                    if not child_sku or child_sku.lower() in ['nan', 'none', '']:
                        continue
                    if not store_name or store_name.lower() in ['nan', 'none', '']:
                        continue
                    
                    deletion_summary["rows_processed"] += 1
                    
                    # Find products matching this SKU and store name
                    matching_products = Product.objects.filter(
                        marketplace_child_sku=child_sku,
                        store__name=store_name
                    ).select_related('store', 'marketplace', 'vendor')
                    
                    if not matching_products.exists():
                        not_found_items.append(f"Row {index + 1}: SKU '{child_sku}' in store '{store_name}' not found")
                        deletion_summary["rows_not_found"] += 1
                        continue
                    
                    # Delete products (VendorPrice will be automatically deleted due to CASCADE)
                    products_deleted = matching_products.count()
                    matching_products.delete()
                    deletion_summary["products_deleted"] += products_deleted
            
            # Clean up temporary file
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Prepare response - match frontend expectations
            message = f"Bulk deletion completed. {deletion_summary['products_deleted']} products deleted."
            
            response_data = {
                "success": True,
                "message": message,
                "deletedCount": deletion_summary["products_deleted"],  # Frontend expects this field
                "summary": deletion_summary
            }
            
            # Include warnings if some items weren't found
            if not_found_items:
                response_data["warnings"] = not_found_items[:10]  # Limit to first 10 warnings
                if len(not_found_items) > 10:
                    response_data["warnings"].append(f"... and {len(not_found_items) - 10} more items not found")
            
            return response_data
            
        except Exception as e:
            # Clean up temporary file on error
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return {
                "success": False,
                "error": f"File processing error: {str(e)}",
                "errorType": "FILE_PROCESSING_ERROR"
            }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Bulk delete failed: {str(e)}",
            "errorType": "BULK_DELETE_ERROR"
        }

@router.get("/export/")
def export_products(request):
    """
    Export all current products as CSV
    """
    try:
        # Get all products with related data
        products = Product.objects.select_related('vendor', 'marketplace', 'store').all()
        
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="system_products.csv"'
        
        # Create CSV writer
        writer = csv.writer(response)
        
        # Write headers
        headers = [
            'Vendor Name',
            'Vendor ID',
            'Is Variation',
            'Variation ID', 
            'Marketplace Name',
            'Store Name',
            'Marketplace Parent SKU',
            'Marketplace Child SKU',
            'Marketplace ID'
        ]
        writer.writerow(headers)
        
        # Write product data
        for product in products:
            row = [
                product.vendor.name if product.vendor else '',
                product.vendor_sku or '',
                'Yes' if product.variation_id else 'No',
                product.variation_id or '',
                product.marketplace.name if product.marketplace else '',
                product.store.name if product.store else '',
                product.marketplace_parent_sku or '',
                product.marketplace_child_sku or '',
                ''  # Marketplace ID - not stored in our model
            ]
            writer.writerow(row)
        
        return response
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": f"Export failed: {str(e)}",
            "errorType": "EXPORT_ERROR"
        })

# ========== SCRAPING FUNCTIONALITY ==========

def get_random_headers() -> Dict[str, str]:
    """Generate random headers for HTTP requests."""
    return {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'priority': 'u=0, i',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': random.choice(USER_AGENTS),
        'referer': 'https://www.ebay.ca/',
        'dnt': '1',
        'connection': 'keep-alive',
    }

async def is_blocked_content(content: str) -> bool:
    """Detect if response indicates blocking."""
    lower_content = content.lower()
    block_indicators = [
        'captcha', 'recaptcha', 'verify you are human',
        'robot check', 'security page', 'access denied',
        'you have been blocked', 'suspicious activity',
        'please enable cookies', 'browser check', 'just a moment',
        'checking your browser', 'ddos protection', 'cloudflare'
    ]
    return any(indicator in lower_content for indicator in block_indicators)

def extract_product_data(soup: BeautifulSoup) -> Dict[str, Any]:
    """Extract all product data from BeautifulSoup object."""
    try:
        # Title extraction
        title_element = soup.select_one(SELECTORS['title'])
        title = title_element.get_text(strip=True) if title_element else "Title not found"
        
        # Price extraction
        price_element = soup.select_one(SELECTORS['price'])
        price = price_element.get_text(strip=True) if price_element else None
        
        # Stock extraction
        stock_element = soup.select_one(SELECTORS['stock'])
        stock = stock_element.get_text(strip=True) if stock_element else None
        
        # Additional data extraction
        message_element = soup.select_one(SELECTORS['message'])
        quantity_info = get_quantity_from_source(str(soup))
        
        # Use message content as quantity if quantity info not found
        if quantity_info == "Quantity info not found" and message_element:
            quantity_info = message_element.get_text(strip=True)
        
        return {
            'success': True,
            'title': title,
            'price': price,
            'stock': stock,
            'quantity': quantity_info,
            'ended_listings': get_ended_listings(soup),
            'seller_away': get_seller_away(soup),
            'shipping_info': get_shipping_info(soup),
            'handling_time': get_handling_time(str(soup)),
            'category_hierarchy': get_category_hierarchy(soup),
            'variation_count': get_variation_count(soup),
            'error_status': ""
        }
    
    except Exception as e:
        logger.error(f"Error extracting product data: {e}")
        return {
            'success': False,
            'error_status': f'Data extraction error: {str(e)}'
        }

def get_quantity_from_source(page_source: str) -> str:
    """Extract quantity information from page source."""
    match = QUANTITY_PATTERN.search(page_source)
    if match:
        min_value = match.group(1)
        max_value = match.group(2)
        return f"Min: {min_value}, Max: {max_value}"
    return "Quantity info not found"

def get_ended_listings(soup: BeautifulSoup) -> str:
    """Extract ended listings status."""
    status_element = soup.select_one(SELECTORS['status_message'])
    return status_element.get_text(strip=True) if status_element else ""

def get_seller_away(soup: BeautifulSoup) -> str:
    """Extract seller away message."""
    seller_away_element = soup.select_one(SELECTORS['seller_away'])
    return seller_away_element.get_text(strip=True) if seller_away_element else ""

def get_shipping_info(soup: BeautifulSoup) -> str:
    """Extract shipping information."""
    shipping_element = soup.select_one(SELECTORS['shipping'])
    return shipping_element.get_text(strip=True) if shipping_element else "No shipping info"

def get_handling_time(page_source: str) -> str:
    """Extract handling time from page source."""
    match = HANDLING_PATTERN.search(page_source)
    if match:
        return f"Will usually ship within {match.group()}"
    return "Handling time info not found"

def get_category_hierarchy(soup: BeautifulSoup) -> str:
    """Extract category hierarchy from breadcrumbs."""
    breadcrumb_elements = soup.select(SELECTORS['breadcrumb'])
    categories = [elem.get_text(strip=True) for elem in breadcrumb_elements]
    return " > ".join(categories) if categories else "Category not found"

def get_variation_count(soup: BeautifulSoup) -> int:
    """Count product variations."""
    select_boxes = soup.select(SELECTORS['select_boxes'])
    return len(select_boxes)

async def scrape_single_product(
    product: Product, 
    session: aiohttp.ClientSession,
    retries: int = 0
) -> Dict[str, Any]:
    """Scrape a single product's data from eBay."""
    # Generate eBay URL
    item_number = str(product.vendor_sku).split('.')[0]
    url = f"https://www.ebay.ca/itm/{item_number}"
    
    try:
        # Apply delays and backoff
        if retries > 0:
            await asyncio.sleep(2 ** retries + random.uniform(1, 3))
        else:
            await asyncio.sleep(random.uniform(2.5, 6.5))

        headers = get_random_headers()
        
        async with session.get(url, timeout=TIMEOUT, headers=headers) as response:
            content = await response.text()

            # Check for blocking
            if await is_blocked_content(content):
                if retries < RETRY_LIMIT:
                    logger.warning(f"Blocked page for {product.vendor_sku}, retrying...")
                    return await scrape_single_product(product, session, retries + 1)
                else:
                    return {
                        'product_id': product.id,
                        'success': False,
                        'error_status': 'Blocked by security (CAPTCHA/Robot check)'
                    }

            if response.status != 200:
                if retries < RETRY_LIMIT:
                    logger.warning(f"HTTP {response.status} for {product.vendor_sku}, retrying...")
                    await asyncio.sleep(2 ** retries + random.uniform(1, 3))
                    return await scrape_single_product(product, session, retries + 1)
                else:
                    return {
                        'product_id': product.id,
                        'success': False,
                        'error_status': f'HTTP {response.status}'
                    }

            soup = BeautifulSoup(content, 'lxml')
            result = extract_product_data(soup)
            result['product_id'] = product.id
            result['url'] = url
            
            return result

    except asyncio.TimeoutError:
        if retries < RETRY_LIMIT:
            logger.warning(f"Timeout for {product.vendor_sku}, retrying...")
            return await scrape_single_product(product, session, retries + 1)
        else:
            return {
                'product_id': product.id,
                'success': False,
                'error_status': 'Request timed out'
            }
    
    except Exception as e:
        if retries < RETRY_LIMIT:
            logger.warning(f"Error scraping {product.vendor_sku}: {e}, retrying...")
            await asyncio.sleep(2 ** retries + random.uniform(1, 4))
            return await scrape_single_product(product, session, retries + 1)
        else:
            logger.error(f"Final error scraping {product.vendor_sku}: {e}")
            return {
                'product_id': product.id,
                'success': False,
                'error_status': f'Exception: {str(e)}'
            }

async def process_products_batch(
    products_batch: List[Product],
    session: aiohttp.ClientSession
) -> List[Dict[str, Any]]:
    """Process a batch of products concurrently."""
    tasks = [
        scrape_single_product(product, session)
        for product in products_batch
    ]
    return await asyncio.gather(*tasks)

@transaction.atomic
def save_scraping_results(results: List[Dict[str, Any]]) -> None:
    """Save scraping results to database efficiently."""
    try:
        # Get timezone for Pakistan time
        tz = pytz.timezone('Asia/Karachi')
        scrape_time = datetime.now(tz)
        
        # Prepare batch updates
        vendor_price_updates = []
        scrape_records = []
        
        for result in results:
            try:
                product = Product.objects.get(id=result['product_id'])
                
                # Parse price and stock
                parsed_price = None
                parsed_stock = None
                
                if result.get('success'):
                    parsed_price = parse_price_to_decimal(result.get('price'))
                    parsed_stock = parse_stock_to_int(result.get('stock'))
                
                # Update VendorPrice
                vendor_price, created = VendorPrice.objects.get_or_create(
                    product=product,
                    defaults={
                        'price': parsed_price,
                        'stock': parsed_stock,
                        'error_code': result.get('error_status', ''),
                        'scraped_at': scrape_time
                    }
                )
                
                if not created:
                    vendor_price.price = parsed_price
                    vendor_price.stock = parsed_stock
                    vendor_price.error_code = result.get('error_status', '')
                    vendor_price.scraped_at = scrape_time
                    vendor_price_updates.append(vendor_price)
                
                # Create Scrape record
                scrape_record = Scrape(
                    product=product,
                    scrape_time=scrape_time,
                    stock=parsed_stock,
                    error_code=result.get('error_status', ''),
                    raw_response=result
                )
                scrape_records.append(scrape_record)
                
            except Product.DoesNotExist:
                logger.error(f"Product {result['product_id']} not found")
            except Exception as e:
                logger.error(f"Error saving result for product {result.get('product_id')}: {e}")
        
        # Batch save operations
        if vendor_price_updates:
            VendorPrice.objects.bulk_update(
                vendor_price_updates,
                ['price', 'stock', 'error_code', 'scraped_at'],
                batch_size=100
            )
        
        if scrape_records:
            Scrape.objects.bulk_create(scrape_records, batch_size=100)
            
        logger.info(f"Saved {len(scrape_records)} scrape results to database")
        
    except Exception as e:
        logger.error(f"Error saving scraping results: {e}")
        raise

async def run_complete_scraping_job(session_id: str) -> Dict[str, Any]:
    """Execute the complete scraping job asynchronously."""
    start_time = datetime.now()
    logger.info(f"Starting scraping job {session_id}")
    
    try:
        # Get eBayUS marketplace
        ebay_marketplace = Marketplace.objects.filter(
            Q(code="eBayUS") | Q(name="eBayUS")
        ).first()
        
        if not ebay_marketplace:
            return {
                'success': False,
                'error': 'eBayUS marketplace not found in database',
                'session_id': session_id,
                'total_products': 0
            }
        
        # Get products to scrape
        products = Product.objects.filter(
            marketplace=ebay_marketplace
        ).select_related('vendor', 'marketplace', 'store', 'upload')
        
        # Validate eBay item numbers
        valid_products = []
        for product in products:
            is_valid, _ = validate_ebay_item_number(product.vendor_sku)
            if is_valid:
                valid_products.append(product)
        
        if not valid_products:
            return {
                'success': False,
                'error': 'No valid eBayUS products found to scrape',
                'session_id': session_id,
                'total_products': 0
            }
        
        # Setup HTTP session with proper connector
        connector = aiohttp.TCPConnector(
            limit_per_host=MAX_CONCURRENT_REQUESTS,
            ssl=False
        )
        
        all_results = []
        
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=TIMEOUT
        ) as session:
            # Process in batches
            for i in range(0, len(valid_products), BATCH_SIZE):
                batch = valid_products[i:i + BATCH_SIZE]
                batch_results = await process_products_batch(batch, session)
                all_results.extend(batch_results)
                
                logger.info(f"Processed batch {i//BATCH_SIZE + 1}, {len(all_results)}/{len(valid_products)} products")
        
        # Save results to database
        save_scraping_results(all_results)
        
        # Update store last_scrape_time
        Store.objects.filter(marketplace=ebay_marketplace).update(
            last_scrape_time=datetime.now()
        )
        
        # Create error log Excel file
        error_log_file = create_error_log_excel(all_results, session_id)
        
        # Calculate statistics
        successful_scrapes = sum(1 for r in all_results if r.get('success'))
        failed_scrapes = len(all_results) - successful_scrapes
        duration = datetime.now() - start_time
        
        result = {
            'success': True,
            'session_id': session_id,
            'total_products': len(valid_products),
            'successful_scrapes': successful_scrapes,
            'failed_scrapes': failed_scrapes,
            'duration_minutes': int(duration.total_seconds() // 60),
            'error_log_file': error_log_file
        }
        
        logger.info(f"Completed scraping job {session_id}: {successful_scrapes}/{len(valid_products)} successful")
        return result
        
    except Exception as e:
        logger.error(f"Error in scraping job {session_id}: {e}")
        return {
            'success': False,
            'error': str(e),
            'session_id': session_id,
            'total_products': 0
        }

@router.post("/scrape/")
async def scrape_products(request):
    """
    Async API to scrape all eBayUS products and update prices/inventory.
    
    This endpoint starts an asynchronous scraping job for all valid eBayUS products.
    It returns immediately with job details, and the actual scraping runs in the background.
    """
    try:
        # Generate session ID
        session_id = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        
        # Get quick product count for response
        ebay_marketplace = Marketplace.objects.filter(
            Q(code="eBayUS") | Q(name="eBayUS")
        ).first()
        
        if not ebay_marketplace:
            return {
                "success": False,
                "error": "eBayUS marketplace not found in database",
                "products_queued": 0
            }
        
        # Quick count of products
        total_products = Product.objects.filter(marketplace=ebay_marketplace).count()
        
        # Start scraping job in background
        asyncio.create_task(run_complete_scraping_job(session_id))
        
        return {
            "success": True,
            "message": "eBayUS scraping started successfully",
            "session_id": session_id,
            "products_queued": total_products,
            "estimated_duration": f"{total_products * 5 // 60} minutes",
            "status": "Scraping job started in background"
        }
        
    except Exception as e:
        logger.error(f"Error starting scraping job: {e}")
        return {
            "success": False,
            "error": f"Failed to start scraping: {str(e)}",
            "products_queued": 0
        }
