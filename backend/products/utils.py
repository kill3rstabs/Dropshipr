from django.apps import apps
from django.db import transaction
from django.db.models import Q
from openpyxl import load_workbook
import pandas as pd
import os
import json


class ValidationError(Exception):
    """Custom exception for validation errors"""
    def __init__(self, message, error_type="VALIDATION_ERROR"):
        super().__init__(message)
        self.error_type = error_type


def read_upload_file(file_path):
    """Read CSV or Excel file and return DataFrame"""
    if file_path.endswith('.csv'):
        return pd.read_csv(file_path)
    else:
        return pd.read_excel(file_path)


def validate_file_structure(df):
    """Validate that the file has all required columns"""
    required_columns = [
        'Vendor Name', 'Vendor ID', 'Marketplace Name', 
        'Store Name', 'Marketplace Child SKU'
    ]
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValidationError(
            f"Missing required columns: {', '.join(missing_columns)}",
            "MISSING_COLUMNS"
        )
    
    # Check for empty rows or completely null required fields
    empty_rows = []
    for index, row in df.iterrows():
        for col in required_columns:
            if pd.isna(row[col]) or str(row[col]).strip() == '':
                empty_rows.append(index)
                break
    
    if empty_rows:
        raise ValidationError(
            f"File contains empty or invalid rows at indices: {empty_rows[:5]}...",
            "EMPTY_ROWS"
        )


def validate_vendors_marketplaces_stores(df):
    """Validate referenced vendor/marketplace/store exists in database"""
    # This function would contain lookups and raise ValidationError on missing refs
    pass


def validate_sku_store_uniqueness(df):
    """Reject duplicate (Store Name, Marketplace Name, Marketplace Child SKU)."""
    # Normalize
    for col in ['Store Name', 'Marketplace Name', 'Marketplace Child SKU']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    key_cols = ['Store Name', 'Marketplace Name', 'Marketplace Child SKU']
    if not all(c in df.columns for c in key_cols):
        return  # structure validation will handle

    # In-file duplicates
    dup_mask = df.duplicated(subset=key_cols, keep=False)
    if dup_mask.any():
        bad = df.loc[dup_mask, key_cols].drop_duplicates().head(10).values.tolist()
        samples = [" | ".join(x) for x in bad]
        raise ValidationError(
            f"Duplicate (Store, Marketplace, Child SKU) rows in file: {samples}{'...' if len(bad)==10 else ''}",
            "DUPLICATE_SKU_STORE_IN_FILE"
        )

    # Against database
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    Store = apps.get_model('marketplace', 'Store')
    Product = apps.get_model('products', 'Product')

    combos = df[key_cols].drop_duplicates().values.tolist()
    errors = []
    for store_name, marketplace_name, child_sku in combos:
        mp = Marketplace.objects.filter(Q(code=marketplace_name) | Q(name=marketplace_name)).first()
        if not mp:
            continue
        store = Store.objects.filter(name=store_name, marketplace=mp).first()
        if not store:
            continue
        if Product.objects.filter(marketplace=mp, store=store, marketplace_child_sku=child_sku).exists():
            errors.append(f"{store_name} | {marketplace_name} | {child_sku}")
        if len(errors) >= 10:
            break

    if errors:
        raise ValidationError(
            f"(Store, Marketplace, Child SKU) already exists in DB: {errors}{'...' if len(errors)==10 else ''}",
            "DUPLICATE_SKU_STORE_IN_DB"
        )


def validate_store_settings(df):
    """Validate store-level settings or constraints if any"""
    # Placeholder for store-level validations
    pass


def _progress_file_path(upload_id: int) -> str:
    uploads_dir = os.path.join("uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    return os.path.join(uploads_dir, f"progress_{upload_id}.json")


def _write_progress(upload_id: int, processed: int, total: int):
    path = _progress_file_path(upload_id)
    tmp = f"{path}.tmp"
    data = {"itemsProcessed": processed, "totalItems": total}
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    os.replace(tmp, path)


def validate_upload_file(file_path):
    """
    Comprehensive validation of upload file.
    Raises ValidationError if any validation fails.
    """
    # Read the file
    df = read_upload_file(file_path)
    
    # Run all validations in sequence
    validate_file_structure(df)
    validate_vendors_marketplaces_stores(df)
    validate_sku_store_uniqueness(df)
    validate_store_settings(df)
    
    return df



def ingest_upload(upload_id):
    """
    Process upload with comprehensive validation and transaction support.
    If any validation fails, the entire operation is rolled back.
    """
    # Get models using Django's app registry to avoid circular imports
    Upload = apps.get_model('products', 'Upload')
    Vendor = apps.get_model('vendor', 'Vendor')
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    Store = apps.get_model('marketplace', 'Store')
    Product = apps.get_model('products', 'Product')
    VendorPrice = apps.get_model('vendor', 'VendorPrice')
    
    upload = Upload.objects.get(id=upload_id)
    
    # First, validate the entire file
    try:
        df = validate_upload_file(upload.stored_key)
    except ValidationError as e:
        # Re-raise validation errors as-is for proper error handling in API
        raise e
    
    # Map column names
    column_mapping = {
        'Vendor Name': 'vendor_name',
        'Vendor ID': 'vendor_id', 
        'Is Variation': 'is_variation',
        'Variation ID': 'variation_id',
        'Marketplace Name': 'marketplace_name',
        'Store Name': 'store_name',
        'Marketplace Parent SKU': 'marketplace_parent_sku',
        'Marketplace Child SKU': 'marketplace_child_sku',
        'Marketplace ID': 'marketplace_id'
    }
    
    df = df.rename(columns=column_mapping)
    
    # Fill NaN values with empty strings for string columns
    string_columns = ['variation_id', 'marketplace_parent_sku', 'marketplace_id']
    for col in string_columns:
        if col in df.columns:
            df[col] = df[col].fillna('')
    
    total_rows = len(df)
    try:
        _write_progress(upload_id, 0, total_rows)
    except Exception:
        pass

    # Process the file within a database transaction
    with transaction.atomic():
        processed_count = 0
        
        for index, row in df.iterrows():
            try:
                # Get vendor (match by code OR name)
                vendor = Vendor.objects.filter(
                    Q(code=str(row['vendor_name']).strip()) | 
                    Q(name=str(row['vendor_name']).strip())
                ).first()
                
                if not vendor:
                    raise ValueError(f"Vendor {str(row['vendor_name']).strip()} not found")
                
                # Get marketplace (match by code OR name)
                marketplace = Marketplace.objects.filter(
                    Q(code=str(row['marketplace_name']).strip()) | 
                    Q(name=str(row['marketplace_name']).strip())
                ).first()
                
                if not marketplace:
                    raise ValueError(f"Marketplace {str(row['marketplace_name']).strip()} not found")
                
                # Get store (must exist)
                store = Store.objects.filter(
                    name=str(row['store_name']).strip(),
                    marketplace=marketplace
                ).first()
                
                if not store:
                    raise ValueError(f"Store {str(row['store_name']).strip()} not found for marketplace {marketplace.name}")
                
                # Handle variation ID
                variation_id = ''
                if 'is_variation' in row and str(row['is_variation']).strip().lower() in ['yes', 'true', '1']:
                    if 'variation_id' in row and pd.notna(row['variation_id']):
                        variation_id = str(row['variation_id']).strip()
                
                # Create or update product using unique triple (marketplace, store, child_sku)
                product, created = Product.objects.update_or_create(
                    marketplace=marketplace,
                    store=store,
                    marketplace_child_sku=str(row['marketplace_child_sku']).strip(),
                    defaults={
                        'vendor': vendor,
                        'vendor_sku': str(row['vendor_id']).strip(),
                        'variation_id': variation_id,
                        'marketplace_parent_sku': str(row.get('marketplace_parent_sku', '')).strip(),
                        'marketplace_external_id': str(row.get('marketplace_id', '') or '').strip(),
                        'upload': upload,
                    }
                )
                
                # Ensure a VendorPrice row exists
                VendorPrice.objects.get_or_create(product=product)
                
                processed_count += 1

                # Periodic progress write (every 100 rows)
                if processed_count % 100 == 0:
                    try:
                        _write_progress(upload_id, processed_count, total_rows)
                    except Exception:
                        pass
                
            except Exception as e:
                # If any error occurs during processing, the transaction will be rolled back
                raise ValidationError(
                    f"Processing failed at row {index + 1}: {str(e)}",
                    "PROCESSING_ERROR"
                )
    
    # Final progress write on success
    try:
        _write_progress(upload_id, processed_count, total_rows)
    except Exception:
        pass

    return processed_count