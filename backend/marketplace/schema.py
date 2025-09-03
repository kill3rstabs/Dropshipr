from ninja import Schema
from typing import List, Optional
from decimal import Decimal

class MarketplaceSchema(Schema):
    id: int
    code: str
    name: str

class PriceRangeSchema(Schema):
    from_value: Decimal
    to_value: str
    margin_percentage: Optional[Decimal] = None
    minimum_margin_cents: Optional[int] = None
    multiplier: Optional[Decimal] = None

class StorePriceSettingsPerVendorSchema(Schema):
    vendor_id: int
    purchase_tax_percentage: Decimal
    marketplace_fees_percentage: Decimal
    price_ranges: List[PriceRangeSchema]

class StoreInventorySettingsPerVendorSchema(Schema):
    vendor_id: int
    inventory_ranges: List[PriceRangeSchema]

class StoreCreateSchema(Schema):
    name: str
    marketplace_id: int
    api_key_enc: Optional[str] = None
    price_settings_by_vendor: List[StorePriceSettingsPerVendorSchema]
    inventory_settings_by_vendor: List[StoreInventorySettingsPerVendorSchema]

class StoreDuplicateSchema(Schema):
    name: str
    marketplace_id: int
    api_key_enc: Optional[str] = None

class StoreResponseSchema(Schema):
    id: int
    name: str
    marketplace: MarketplaceSchema
    api_key_enc: Optional[str]
    is_active: bool
    created_at: str
    price_settings_by_vendor: List[StorePriceSettingsPerVendorSchema]
    inventory_settings_by_vendor: List[StoreInventorySettingsPerVendorSchema]

class StoreActiveSchema(Schema):
    is_active: bool 