from django.db import models
from django.utils import timezone

# Create your models here.

class Product(models.Model):
    vendor = models.ForeignKey(
        'vendor.Vendor',
        on_delete=models.CASCADE,
        related_name="products",
    )
    vendor_sku = models.CharField(max_length=255)
    variation_id = models.CharField(max_length=255, blank=True)
    marketplace_child_sku = models.CharField(max_length=255)
    marketplace_parent_sku = models.CharField(max_length=255, blank=True)
    marketplace = models.ForeignKey(
        'marketplace.Marketplace',
        on_delete=models.CASCADE,
        related_name="products",
    )
    store = models.ForeignKey(
        'marketplace.Store',
        on_delete=models.CASCADE,
        related_name="products",
    )

    def __str__(self):
        return f"{self.vendor_sku} ({self.marketplace_child_sku})"
    
    
    
class Upload(models.Model):
    original_name = models.CharField(max_length=255)
    stored_key = models.CharField(max_length=255)
    note = models.TextField(blank=True)
    expires_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.original_name
    
class Scrape(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="scrapes",
    )
    scrape_time = models.DateTimeField(default=timezone.now)
    price_cents = models.PositiveIntegerField(null=True, blank=True)
    stock = models.IntegerField(null=True, blank=True)
    error_code = models.CharField(max_length=50, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Scrape of {self.product_id} at {self.scrape_time}"
    

