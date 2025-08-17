#!/usr/bin/env python
"""
Test script for the store creation API
"""
import os
import sys
import django
import requests
import json

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
django.setup()

# Test data for creating a store
test_store_data = {
    "name": "Test Store",
    "marketplace_id": 1,  # Assuming marketplace with ID 1 exists
    "api_key_enc": "test_api_key_123",
    "price_settings": {
        "purchase_tax_percentage": "5.00",
        "marketplace_fees_percentage": "10.00",
        "price_ranges": [
            {
                "from_value": "0.00",
                "to_value": "MAX",
                "margin_percentage": "30.00",
                "minimum_margin_cents": 2500
            }
        ]
    },
    "inventory_settings": {
        "inventory_ranges": [
            {
                "from_value": "0.00",
                "to_value": "MAX",
                "multiplier": "0.50"
            }
        ]
    }
}

def test_api():
    base_url = "http://localhost:8000/api/marketplace"
    
    print("Testing Store Creation API...")
    print("=" * 50)
    
    # Test 1: Get marketplaces
    print("1. Getting marketplaces...")
    try:
        response = requests.get(f"{base_url}/marketplaces")
        if response.status_code == 200:
            marketplaces = response.json()
            print(f"   Found {len(marketplaces)} marketplaces")
            for m in marketplaces:
                print(f"   - {m['name']} (ID: {m['id']})")
        else:
            print(f"   Error: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print()
    
    # Test 2: Create store
    print("2. Creating store...")
    try:
        response = requests.post(
            f"{base_url}/stores",
            json=test_store_data,
            headers={'Content-Type': 'application/json'}
        )
        if response.status_code == 200:
            store = response.json()
            print(f"   Store created successfully!")
            print(f"   Store ID: {store['id']}")
            print(f"   Store Name: {store['name']}")
            print(f"   Marketplace: {store['marketplace']['name']}")
            return store['id']
        else:
            print(f"   Error: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    return None

def test_get_store(store_id):
    if not store_id:
        return
    
    base_url = "http://localhost:8000/api/marketplace"
    
    print()
    print("3. Getting store details...")
    try:
        response = requests.get(f"{base_url}/stores/{store_id}")
        if response.status_code == 200:
            store = response.json()
            print(f"   Store retrieved successfully!")
            print(f"   Price Settings:")
            print(f"     - Purchase Tax: {store['price_settings']['purchase_tax_percentage']}%")
            print(f"     - Marketplace Fees: {store['price_settings']['marketplace_fees_percentage']}%")
            print(f"     - Price Ranges: {len(store['price_settings']['price_ranges'])}")
            print(f"   Inventory Settings:")
            print(f"     - Inventory Ranges: {len(store['inventory_settings']['inventory_ranges'])}")
        else:
            print(f"   Error: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    print("Starting API tests...")
    store_id = test_api()
    test_get_store(store_id)
    print("\nAPI tests completed!") 