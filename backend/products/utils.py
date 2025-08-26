from django.apps import apps
from django.db import transaction
from django.db.models import Q
from openpyxl import load_workbook
import pandas as pd


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
                empty_rows.append(f"Row {index + 1}: Empty value in column '{col}'")
    
    if empty_rows:
        raise ValidationError(
            f"Empty required fields found: {'; '.join(empty_rows[:5])}{'...' if len(empty_rows) > 5 else ''}",
            "EMPTY_REQUIRED_FIELDS"
        )


def validate_vendors_marketplaces_stores(df):
    """Validate that all vendors, marketplaces, and stores exist in the database"""
    # Get models
    Vendor = apps.get_model('vendor', 'Vendor')
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    Store = apps.get_model('marketplace', 'Store')
    
    errors = []
    
    # Get unique values from the file
    unique_vendors = df['Vendor Name'].str.strip().unique()
    unique_marketplaces = df['Marketplace Name'].str.strip().unique()
    unique_stores = df['Store Name'].str.strip().unique()
    
    # Check vendors (match by code OR name)
    for vendor_name in unique_vendors:
        if not Vendor.objects.filter(
            Q(code=vendor_name) | Q(name=vendor_name)
        ).exists():
            errors.append(f"Vendor '{vendor_name}' not found in database")
    
    # Check marketplaces (match by code OR name)
    for marketplace_name in unique_marketplaces:
        if not Marketplace.objects.filter(
            Q(code=marketplace_name) | Q(name=marketplace_name)
        ).exists():
            errors.append(f"Marketplace '{marketplace_name}' not found in database")
    
    # Check stores with their marketplaces (more complex validation)
    store_marketplace_pairs = df[['Store Name', 'Marketplace Name']].drop_duplicates()
    for _, row in store_marketplace_pairs.iterrows():
        store_name = str(row['Store Name']).strip()
        marketplace_name = str(row['Marketplace Name']).strip()
        
        # Find the marketplace first
        marketplace = Marketplace.objects.filter(
            Q(code=marketplace_name) | Q(name=marketplace_name)
        ).first()
        
        if marketplace:
            # Check if store exists for this marketplace
            if not Store.objects.filter(name=store_name, marketplace=marketplace).exists():
                errors.append(f"Store '{store_name}' not found for marketplace '{marketplace_name}'")
        else:
            # Marketplace not found (already reported above, but this is for store context)
            errors.append(f"Cannot validate store '{store_name}' - marketplace '{marketplace_name}' not found")
    
    if errors:
        raise ValidationError(
            f"Entity validation failed: {'; '.join(errors)}",
            "ENTITY_NOT_FOUND"
        )


def validate_sku_store_uniqueness(df):
    """Validate that Marketplace Child SKU + Store Name is unique in file and database"""
    Product = apps.get_model('products', 'Product')
    Store = apps.get_model('marketplace', 'Store')
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    
    errors = []
    
    # Check uniqueness within the file
    sku_store_combinations = []
    duplicates_in_file = []
    
    for index, row in df.iterrows():
        sku = str(row['Marketplace Child SKU']).strip()
        store_name = str(row['Store Name']).strip()
        combination = (sku, store_name)
        
        if combination in sku_store_combinations:
            duplicates_in_file.append(f"Row {index + 1}: SKU '{sku}' + Store '{store_name}' already exists in file")
        else:
            sku_store_combinations.append(combination)
    
    if duplicates_in_file:
        errors.extend(duplicates_in_file)
    
    # Check uniqueness against database
    for index, row in df.iterrows():
        sku = str(row['Marketplace Child SKU']).strip()
        store_name = str(row['Store Name']).strip()
        marketplace_name = str(row['Marketplace Name']).strip()
        
        # Find marketplace and store
        marketplace = Marketplace.objects.filter(
            Q(code=marketplace_name) | Q(name=marketplace_name)
        ).first()
        
        if marketplace:
            store = Store.objects.filter(name=store_name, marketplace=marketplace).first()
            if store:
                # Check if this SKU + Store combination exists in database
                if Product.objects.filter(marketplace_child_sku=sku, store=store).exists():
                    errors.append(f"Row {index + 1}: SKU '{sku}' + Store '{store_name}' already exists in database")
    
    if errors:
        raise ValidationError(
            f"SKU uniqueness validation failed: {'; '.join(errors[:10])}{'...' if len(errors) > 10 else ''}",
            "DUPLICATE_SKU_STORE"
        )


def validate_store_settings(df):
    """Validate that all stores have proper price and inventory settings with ranges"""
    Store = apps.get_model('marketplace', 'Store')
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    StorePriceSettings = apps.get_model('marketplace', 'StorePriceSettings')
    StoreInventorySettings = apps.get_model('marketplace', 'StoreInventorySettings')
    PriceRangeMargin = apps.get_model('marketplace', 'PriceRangeMargin')
    InventoryRangeMultiplier = apps.get_model('marketplace', 'InventoryRangeMultiplier')
    
    errors = []
    
    # Get unique store-marketplace combinations
    store_marketplace_pairs = df[['Store Name', 'Marketplace Name']].drop_duplicates()
    
    for _, row in store_marketplace_pairs.iterrows():
        store_name = str(row['Store Name']).strip()
        marketplace_name = str(row['Marketplace Name']).strip()
        
        # Find marketplace and store
        marketplace = Marketplace.objects.filter(
            Q(code=marketplace_name) | Q(name=marketplace_name)
        ).first()
        
        if not marketplace:
            continue  # Skip - marketplace validation will catch this
            
        store = Store.objects.filter(name=store_name, marketplace=marketplace).first()
        if not store:
            continue  # Skip - store validation will catch this
        
        # Check if StorePriceSettings exists
        try:
            price_settings = StorePriceSettings.objects.get(store=store)
            # Check if price settings has at least one price range
            if not PriceRangeMargin.objects.filter(price_settings=price_settings).exists():
                errors.append(f"Store '{store_name}' has no price ranges configured")
        except StorePriceSettings.DoesNotExist:
            errors.append(f"Store '{store_name}' has no price settings configured")
        
        # Check if StoreInventorySettings exists
        try:
            inventory_settings = StoreInventorySettings.objects.get(store=store)
            # Check if inventory settings has at least one inventory range
            if not InventoryRangeMultiplier.objects.filter(inventory_settings=inventory_settings).exists():
                errors.append(f"Store '{store_name}' has no inventory ranges configured")
        except StoreInventorySettings.DoesNotExist:
            errors.append(f"Store '{store_name}' has no inventory settings configured")
    
    if errors:
        raise ValidationError(
            f"Store settings validation failed: {'; '.join(errors)}",
            "INCOMPLETE_STORE_SETTINGS"
        )


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
                
                # Create or update product
                product, created = Product.objects.update_or_create(
                    vendor=vendor,
                    vendor_sku=str(row['vendor_id']).strip(),
                    variation_id=variation_id,
                    marketplace_child_sku=str(row['marketplace_child_sku']).strip(),
                    marketplace=marketplace,
                    store=store,
                    defaults={
                        'marketplace_parent_sku': str(row.get('marketplace_parent_sku', '')).strip(),
                        'upload': upload,  # 🆕 Track which upload created this product
                    }
                )
                
                # Ensure a VendorPrice row exists
                VendorPrice.objects.get_or_create(product=product)
                
                processed_count += 1
                
            except Exception as e:
                # If any error occurs during processing, the transaction will be rolled back
                raise ValidationError(
                    f"Processing failed at row {index + 1}: {str(e)}",
                    "PROCESSING_ERROR"
                )
    
    return processed_count