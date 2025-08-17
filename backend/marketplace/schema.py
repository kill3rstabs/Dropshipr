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

class StorePriceSettingsSchema(Schema):
    purchase_tax_percentage: Decimal
    marketplace_fees_percentage: Decimal
    price_ranges: List[PriceRangeSchema]

class StoreInventorySettingsSchema(Schema):
    inventory_ranges: List[PriceRangeSchema]

class StoreCreateSchema(Schema):
    name: str
    marketplace_id: int
    api_key_enc: Optional[str] = None
    price_settings: StorePriceSettingsSchema
    inventory_settings: StoreInventorySettingsSchema

class StoreResponseSchema(Schema):
    id: int
    name: str
    marketplace: MarketplaceSchema
    api_key_enc: Optional[str]
    scraping_enabled: bool
    scraping_interval_hours: int
    price_update_enabled: bool
    is_active: bool
    created_at: str
    price_settings: StorePriceSettingsSchema
    inventory_settings: StoreInventorySettingsSchema 