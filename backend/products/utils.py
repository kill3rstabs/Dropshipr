from django.apps import apps
from openpyxl import load_workbook
import pandas as pd


def ingest_upload(upload_id):
    # Get models using Django's app registry to avoid circular imports
    Upload = apps.get_model('products', 'Upload')
    Vendor = apps.get_model('vendor', 'Vendor')
    Marketplace = apps.get_model('marketplace', 'Marketplace')
    Store = apps.get_model('marketplace', 'Store')
    Product = apps.get_model('products', 'Product')
    VendorPrice = apps.get_model('vendor', 'VendorPrice')
    
    upload = Upload.objects.get(id=upload_id)
    df = pd.read_excel(upload.stored_key)

    for _, row in df.iterrows():
        vendor, _ = Vendor.objects.get_or_create(code=row['vendor_name'])
        marketplace, _ = Marketplace.objects.get_or_create(code=row['marketplace_name'])
        store = Store.objects.get(name=row['store_name'], marketplace=marketplace)

        product, created = Product.objects.update_or_create(
            vendor=vendor,
            vendor_sku=row['vendor_id'],
            variation_id=row['variation_id'] or '',
            marketplace_child_sku=row['marketplace_child_sku'],
            marketplace=marketplace,
            store=store,
            defaults={
                'marketplace_parent_sku': row['marketplace_parent_sku'] or '',
            }
        )
        # ensure a VendorPrice row exists (price NULL until first scrape)
        VendorPrice.objects.get_or_create(product=product)