from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal

# Create your models here.
class Marketplace(models.Model):
    code = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class Store(models.Model):
    marketplace = models.ForeignKey(
        Marketplace,
        on_delete=models.CASCADE,
        related_name="stores",
    )
    name = models.CharField(max_length=255)
    api_key_enc = models.TextField(blank=True)
    settings = models.JSONField(default=dict, blank=True)
    # Add these fields for scraping configuration
    scraping_enabled = models.BooleanField(default=True)
    scraping_interval_hours = models.IntegerField(default=24)
    last_scrape_time = models.DateTimeField(null=True, blank=True)
    price_update_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class PriceRange(models.Model):
    """Reusable price range model for both price and inventory settings"""
    from_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    to_value = models.CharField(max_length=20, default="MAX")  # "MAX" or numeric value
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['from_value', 'to_value']

    def __str__(self):
        return f"{self.from_value} - {self.to_value}"

class StorePriceSettings(models.Model):
    """Store- and vendor-specific price settings"""
    store = models.ForeignKey('marketplace.Store', on_delete=models.CASCADE, related_name="price_settings_by_vendor")
    vendor = models.ForeignKey('vendor.Vendor', on_delete=models.CASCADE, related_name="store_price_settings")
    purchase_tax_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    marketplace_fees_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('store', 'vendor')]

    def __str__(self):
        return f"Price settings for {self.store.name} - {self.vendor.name}"

class PriceRangeMargin(models.Model):
    """Price range with margin settings"""
    price_settings = models.ForeignKey(
        StorePriceSettings, 
        on_delete=models.CASCADE, 
        related_name="price_ranges"
    )
    price_range = models.ForeignKey(PriceRange, on_delete=models.CASCADE)
    margin_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(1000)]
    )
    minimum_margin_cents = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['price_settings', 'price_range']

    def __str__(self):
        return f"{self.price_range} - {self.margin_percentage}% margin"

class StoreInventorySettings(models.Model):
    """Store- and vendor-specific inventory settings"""
    store = models.ForeignKey('marketplace.Store', on_delete=models.CASCADE, related_name="inventory_settings_by_vendor")
    vendor = models.ForeignKey('vendor.Vendor', on_delete=models.CASCADE, related_name="store_inventory_settings")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('store', 'vendor')]

    def __str__(self):
        return f"Inventory settings for {self.store.name} - {self.vendor.name}"

class InventoryRangeMultiplier(models.Model):
    """Inventory range with multiplier settings"""
    inventory_settings = models.ForeignKey(
        StoreInventorySettings, 
        on_delete=models.CASCADE, 
        related_name="inventory_ranges"
    )
    price_range = models.ForeignKey(PriceRange, on_delete=models.CASCADE)
    multiplier = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        validators=[MinValueValidator(0.01), MaxValueValidator(100)]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['inventory_settings', 'price_range']

    def __str__(self):
        return f"{self.price_range} - {self.multiplier}x multiplier"