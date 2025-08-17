#!/usr/bin/env python
"""
Test script to verify that all models can be imported without circular dependencies
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
django.setup()

def test_model_imports():
    """Test that all models can be imported without circular dependencies"""
    print("Testing model imports...")
    
    try:
        # Test vendor models
        from vendor.models import Vendor, VendorPrice
        print("✅ Vendor models imported successfully")
        
        # Test marketplace models
        from marketplace.models import (
            Marketplace, Store, PriceRange, StorePriceSettings, 
            PriceRangeMargin, StoreInventorySettings, InventoryRangeMultiplier
        )
        print("✅ Marketplace models imported successfully")
        
        # Test products models
        from products.models import Product, Upload, Scrape
        print("✅ Products models imported successfully")
        
        # Test relationships
        print("\nTesting model relationships...")
        
        # Test that we can access related models
        vendor = Vendor(code="test", name="Test Vendor")
        print(f"✅ Created Vendor: {vendor}")
        
        marketplace = Marketplace(code="test", name="Test Marketplace")
        print(f"✅ Created Marketplace: {marketplace}")
        
        store = Store(marketplace=marketplace, name="Test Store")
        print(f"✅ Created Store: {store}")
        
        product = Product(
            vendor=vendor,
            vendor_sku="TEST123",
            marketplace_child_sku="CHILD123",
            marketplace=marketplace,
            store=store
        )
        print(f"✅ Created Product: {product}")
        
        print("\n🎉 All models imported and relationships tested successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error importing models: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_utils_imports():
    """Test that utils can import models without circular dependencies"""
    print("\nTesting utils imports...")
    
    try:
        from products.utils import ingest_upload
        print("✅ Products utils imported successfully")
        return True
    except Exception as e:
        print(f"❌ Error importing utils: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("CIRCULAR DEPENDENCY TEST")
    print("=" * 50)
    
    models_ok = test_model_imports()
    utils_ok = test_utils_imports()
    
    if models_ok and utils_ok:
        print("\n🎉 All circular dependencies resolved successfully!")
        sys.exit(0)
    else:
        print("\n❌ Circular dependency issues found!")
        sys.exit(1) 