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
    MarketplaceSchema, PriceRangeSchema, StorePriceSettingsPerVendorSchema,
    StoreInventorySettingsPerVendorSchema, StoreCreateSchema, StoreResponseSchema, StoreActiveSchema, StoreDuplicateSchema
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
    """Create a new store with vendor-scoped settings"""
    # Validate marketplace exists
    marketplace = get_object_or_404(Marketplace, id=payload.marketplace_id)

    # Create store
    store = Store.objects.create(
        name=payload.name,
        marketplace=marketplace,
        api_key_enc=payload.api_key_enc or ""
    )

    # Create price settings per vendor
    for settings_by_vendor in payload.price_settings_by_vendor:
        sps = StorePriceSettings.objects.create(
            store=store,
            vendor_id=settings_by_vendor.vendor_id,
            purchase_tax_percentage=settings_by_vendor.purchase_tax_percentage,
            marketplace_fees_percentage=settings_by_vendor.marketplace_fees_percentage,
        )
        for pr in settings_by_vendor.price_ranges:
            price_range, _ = PriceRange.objects.get_or_create(
                from_value=pr.from_value,
                to_value=pr.to_value
            )
            PriceRangeMargin.objects.create(
                price_settings=sps,
                price_range=price_range,
                margin_percentage=pr.margin_percentage or Decimal('0'),
                minimum_margin_cents=pr.minimum_margin_cents or 0
            )

    # Create inventory settings per vendor
    for inv_by_vendor in payload.inventory_settings_by_vendor:
        sis = StoreInventorySettings.objects.create(
            store=store,
            vendor_id=inv_by_vendor.vendor_id,
        )
        for ir in inv_by_vendor.inventory_ranges:
            price_range, _ = PriceRange.objects.get_or_create(
                from_value=ir.from_value,
                to_value=ir.to_value
            )
            InventoryRangeMultiplier.objects.create(
                inventory_settings=sis,
                price_range=price_range,
                multiplier=ir.multiplier or Decimal('0')
            )

    return get_store_response(store)

@router.post("/stores/{store_id}/duplicate", response=StoreResponseSchema)
@transaction.atomic
def duplicate_store(request, store_id: int, payload: StoreDuplicateSchema):
    """Duplicate an existing store and all vendor-scoped settings"""
    source = get_object_or_404(Store, id=store_id)
    marketplace = get_object_or_404(Marketplace, id=payload.marketplace_id)

    # Create new store
    new_store = Store.objects.create(
        name=payload.name,
        marketplace=marketplace,
        api_key_enc=payload.api_key_enc or source.api_key_enc or "",
        is_active=True,
    )

    # Copy price settings
    for sps in StorePriceSettings.objects.filter(store=source):
        new_sps = StorePriceSettings.objects.create(
            store=new_store,
            vendor_id=sps.vendor_id,
            purchase_tax_percentage=sps.purchase_tax_percentage,
            marketplace_fees_percentage=sps.marketplace_fees_percentage,
        )
        for margin in sps.price_ranges.all():
            PriceRangeMargin.objects.create(
                price_settings=new_sps,
                price_range=margin.price_range,
                margin_percentage=margin.margin_percentage,
                minimum_margin_cents=margin.minimum_margin_cents,
            )

    # Copy inventory settings
    for sis in StoreInventorySettings.objects.filter(store=source):
        new_sis = StoreInventorySettings.objects.create(
            store=new_store,
            vendor_id=sis.vendor_id,
        )
        for mult in sis.inventory_ranges.all():
            InventoryRangeMultiplier.objects.create(
                inventory_settings=new_sis,
                price_range=mult.price_range,
                multiplier=mult.multiplier,
            )

    return get_store_response(new_store)

@router.get("/stores/{store_id}", response=StoreResponseSchema)
def get_store(request, store_id: int):
    """Get store details with all vendor-scoped settings"""
    store = get_object_or_404(Store, id=store_id)
    return get_store_response(store)

@router.put("/stores/{store_id}", response=StoreResponseSchema)
@transaction.atomic
def update_store(request, store_id: int, payload: StoreCreateSchema):
    """Update store and vendor-scoped settings"""
    store = get_object_or_404(Store, id=store_id)
    marketplace = get_object_or_404(Marketplace, id=payload.marketplace_id)

    # Update store
    store.name = payload.name
    store.marketplace = marketplace
    store.api_key_enc = payload.api_key_enc or ""
    store.save()

    # Replace price settings for vendors provided in payload
    StorePriceSettings.objects.filter(store=store).delete()
    for settings_by_vendor in payload.price_settings_by_vendor:
        sps = StorePriceSettings.objects.create(
            store=store,
            vendor_id=settings_by_vendor.vendor_id,
            purchase_tax_percentage=settings_by_vendor.purchase_tax_percentage,
            marketplace_fees_percentage=settings_by_vendor.marketplace_fees_percentage,
        )
        for pr in settings_by_vendor.price_ranges:
            price_range, _ = PriceRange.objects.get_or_create(
                from_value=pr.from_value,
                to_value=pr.to_value
            )
            PriceRangeMargin.objects.create(
                price_settings=sps,
                price_range=price_range,
                margin_percentage=pr.margin_percentage or Decimal('0'),
                minimum_margin_cents=pr.minimum_margin_cents or 0
            )

    # Replace inventory settings for vendors provided in payload
    StoreInventorySettings.objects.filter(store=store).delete()
    for inv_by_vendor in payload.inventory_settings_by_vendor:
        sis = StoreInventorySettings.objects.create(
            store=store,
            vendor_id=inv_by_vendor.vendor_id,
        )
        for ir in inv_by_vendor.inventory_ranges:
            price_range, _ = PriceRange.objects.get_or_create(
                from_value=ir.from_value,
                to_value=ir.to_value
            )
            InventoryRangeMultiplier.objects.create(
                inventory_settings=sis,
                price_range=price_range,
                multiplier=ir.multiplier or Decimal('0')
            )

    return get_store_response(store)

@router.put("/stores/{store_id}/active", response=StoreResponseSchema)
@transaction.atomic
def set_store_active(request, store_id: int, payload: StoreActiveSchema):
    """Set a store's active status only"""
    store = get_object_or_404(Store, id=store_id)
    store.is_active = payload.is_active
    store.save(update_fields=["is_active", "updated_at"])
    return get_store_response(store)

@router.delete("/stores/{store_id}")
def delete_store(request, store_id: int):
    """Delete a store and all its settings"""
    store = get_object_or_404(Store, id=store_id)
    store.delete()
    return {"success": True, "message": "Store deleted successfully"}

@router.get("/stores")
def list_stores(request, marketplace_id: Optional[int] = None, active_only: bool = True):
    """List all stores with optional filtering (summary only)"""
    stores = Store.objects.select_related('marketplace')

    if marketplace_id:
        stores = stores.filter(marketplace_id=marketplace_id)

    if active_only:
        stores = stores.filter(is_active=True)

    data = []
    for store in stores:
        data.append({
            "id": store.id,
            "name": store.name,
            "marketplace": {
                "id": store.marketplace.id,
                "code": store.marketplace.code,
                "name": store.marketplace.name
            },
            "api_key_enc": store.api_key_enc,
            "is_active": store.is_active,
            "created_at": store.created_at.isoformat(),
            "vendor_settings_summary": {
                "price_settings_vendors": StorePriceSettings.objects.filter(store=store).count(),
                "inventory_settings_vendors": StoreInventorySettings.objects.filter(store=store).count(),
            }
        })
    return data

# Helper function to build store response
def get_store_response(store):
    """Helper function to build complete store response with vendor arrays"""

    price_settings_by_vendor = []
    for sps in StorePriceSettings.objects.filter(store=store).select_related('vendor'):
        price_ranges = []
        for margin in sps.price_ranges.all():
            price_ranges.append({
                "from_value": margin.price_range.from_value,
                "to_value": margin.price_range.to_value,
                "margin_percentage": margin.margin_percentage,
                "minimum_margin_cents": margin.minimum_margin_cents
            })
        price_settings_by_vendor.append({
            "vendor_id": sps.vendor_id,
            "purchase_tax_percentage": sps.purchase_tax_percentage,
            "marketplace_fees_percentage": sps.marketplace_fees_percentage,
            "price_ranges": price_ranges,
        })

    inventory_settings_by_vendor = []
    for sis in StoreInventorySettings.objects.filter(store=store).select_related('vendor'):
        inventory_ranges = []
        for multiplier in sis.inventory_ranges.all():
            inventory_ranges.append({
                "from_value": multiplier.price_range.from_value,
                "to_value": multiplier.price_range.to_value,
                "multiplier": multiplier.multiplier
            })
        inventory_settings_by_vendor.append({
            "vendor_id": sis.vendor_id,
            "inventory_ranges": inventory_ranges,
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
        "is_active": store.is_active,
        "created_at": store.created_at.isoformat(),
        "price_settings_by_vendor": price_settings_by_vendor,
        "inventory_settings_by_vendor": inventory_settings_by_vendor,
    }