from ninja import NinjaAPI, Schema
from ninja.errors import HttpError
from django.shortcuts import get_object_or_404
from django.db import transaction
from typing import List, Optional
from decimal import Decimal
import json

from .models import (
    Marketplace, Store, StorePriceSettings, StoreInventorySettings,
    PriceRange, PriceRangeMargin, InventoryRangeMultiplier
)
from ninja.router import Router
from .schema import (
    MarketplaceSchema, PriceRangeSchema, StorePriceSettingsSchema,
    StoreInventorySettingsSchema, StoreCreateSchema, StoreResponseSchema
)

# Create API instance
router = Router()

# API endpoints
@router.get("/marketplaces", response=List[MarketplaceSchema])
def get_marketplaces(request):
    """Get all available marketplaces"""
    marketplaces = Marketplace.objects.all()
    return [
        {
            "id": m.id,
            "code": m.code,
            "name": m.name
        }
        for m in marketplaces
    ]

@router.post("/stores", response=StoreResponseSchema)
@transaction.atomic
def create_store(request, payload: StoreCreateSchema):
    """Create a new store with all settings"""
    
    # Validate marketplace exists
    marketplace = get_object_or_404(Marketplace, id=payload.marketplace_id)
    
    # Create store
    store = Store.objects.create(
        name=payload.name,
        marketplace=marketplace,
        api_key_enc=payload.api_key_enc or ""
    )
    
    # Create price settings
    price_settings = StorePriceSettings.objects.create(
        store=store,
        purchase_tax_percentage=payload.price_settings.purchase_tax_percentage,
        marketplace_fees_percentage=payload.price_settings.marketplace_fees_percentage
    )
    
    # Create price ranges and margins
    for price_range_data in payload.price_settings.price_ranges:
        price_range, _ = PriceRange.objects.get_or_create(
            from_value=price_range_data.from_value,
            to_value=price_range_data.to_value
        )
        
        PriceRangeMargin.objects.create(
            price_settings=price_settings,
            price_range=price_range,
            margin_percentage=price_range_data.margin_percentage,
            minimum_margin_cents=price_range_data.minimum_margin_cents or 0
        )
    
    # Create inventory settings
    inventory_settings = StoreInventorySettings.objects.create(store=store)
    
    # Create inventory ranges and multipliers
    for inventory_range_data in payload.inventory_settings.inventory_ranges:
        price_range, _ = PriceRange.objects.get_or_create(
            from_value=inventory_range_data.from_value,
            to_value=inventory_range_data.to_value
        )
        
        InventoryRangeMultiplier.objects.create(
            inventory_settings=inventory_settings,
            price_range=price_range,
            multiplier=inventory_range_data.multiplier
        )
    
    return get_store_response(store)

@router.get("/stores/{store_id}", response=StoreResponseSchema)
def get_store(request, store_id: int):
    """Get store details with all settings"""
    store = get_object_or_404(Store, id=store_id)
    return get_store_response(store)

@router.put("/stores/{store_id}", response=StoreResponseSchema)
@transaction.atomic
def update_store(request, store_id: int, payload: StoreCreateSchema):
    """Update store and all settings"""
    
    store = get_object_or_404(Store, id=store_id)
    marketplace = get_object_or_404(Marketplace, id=payload.marketplace_id)
    
    # Update store basic info
    store.name = payload.name
    store.marketplace = marketplace
    store.api_key_enc = payload.api_key_enc or ""
    store.save()
    
    # Update price settings
    price_settings = store.price_settings
    price_settings.purchase_tax_percentage = payload.price_settings.purchase_tax_percentage
    price_settings.marketplace_fees_percentage = payload.price_settings.marketplace_fees_percentage
    price_settings.save()
    
    # Clear existing price ranges and recreate
    price_settings.price_ranges.all().delete()
    for price_range_data in payload.price_settings.price_ranges:
        price_range, _ = PriceRange.objects.get_or_create(
            from_value=price_range_data.from_value,
            to_value=price_range_data.to_value
        )
        
        PriceRangeMargin.objects.create(
            price_settings=price_settings,
            price_range=price_range,
            margin_percentage=price_range_data.margin_percentage,
            minimum_margin_cents=price_range_data.minimum_margin_cents or 0
        )
    
    # Update inventory settings
    inventory_settings = store.inventory_settings
    
    # Clear existing inventory ranges and recreate
    inventory_settings.inventory_ranges.all().delete()
    for inventory_range_data in payload.inventory_settings.inventory_ranges:
        price_range, _ = PriceRange.objects.get_or_create(
            from_value=inventory_range_data.from_value,
            to_value=inventory_range_data.to_value
        )
        
        InventoryRangeMultiplier.objects.create(
            inventory_settings=inventory_settings,
            price_range=price_range,
            multiplier=inventory_range_data.multiplier
        )
    
    return get_store_response(store)

@router.delete("/stores/{store_id}")
def delete_store(request, store_id: int):
    """Delete a store and all its settings"""
    store = get_object_or_404(Store, id=store_id)
    store.delete()
    return {"success": True, "message": "Store deleted successfully"}

@router.get("/stores", response=List[StoreResponseSchema])
def list_stores(request, marketplace_id: Optional[int] = None, active_only: bool = True):
    """List all stores with optional filtering"""
    stores = Store.objects.select_related('marketplace', 'price_settings', 'inventory_settings')
    
    if marketplace_id:
        stores = stores.filter(marketplace_id=marketplace_id)
    
    if active_only:
        stores = stores.filter(is_active=True)
    
    return [get_store_response(store) for store in stores]

# Helper function to build store response
def get_store_response(store):
    """Helper function to build complete store response"""
    
    # Get price settings
    price_ranges = []
    if hasattr(store, 'price_settings'):
        for margin in store.price_settings.price_ranges.all():
            price_ranges.append({
                "from_value": margin.price_range.from_value,
                "to_value": margin.price_range.to_value,
                "margin_percentage": margin.margin_percentage,
                "minimum_margin_cents": margin.minimum_margin_cents
            })
    
    # Get inventory settings
    inventory_ranges = []
    if hasattr(store, 'inventory_settings'):
        for multiplier in store.inventory_settings.inventory_ranges.all():
            inventory_ranges.append({
                "from_value": multiplier.price_range.from_value,
                "to_value": multiplier.price_range.to_value,
                "multiplier": multiplier.multiplier
            })
    
    return {
        "id": store.id,
        "name": store.name,
        "marketplace": {
            "id": store.marketplace.id,
            "code": store.marketplace.code,
            "name": store.marketplace.name
        },
        "api_key_enc": store.api_key_enc,
        "scraping_enabled": store.scraping_enabled,
        "scraping_interval_hours": store.scraping_interval_hours,
        "price_update_enabled": store.price_update_enabled,
        "is_active": store.is_active,
        "created_at": store.created_at.isoformat(),
        "price_settings": {
            "purchase_tax_percentage": store.price_settings.purchase_tax_percentage if hasattr(store, 'price_settings') else Decimal('0'),
            "marketplace_fees_percentage": store.price_settings.marketplace_fees_percentage if hasattr(store, 'price_settings') else Decimal('0'),
            "price_ranges": price_ranges
        },
        "inventory_settings": {
            "inventory_ranges": inventory_ranges
        }
    }