"""
Product models for managing marketplace inventory and scraping.

This module contains models for products, uploads, and scraping operations.
All models follow Django best practices for field definitions and relationships.
"""

from django.db import models
from django.utils import timezone


class Product(models.Model):
    """
    Represents a product in the marketplace with vendor and marketplace details.
    
    This model tracks products that can be scraped for price and inventory updates.
    Each product belongs to a vendor, marketplace, and store, and can be linked
    to the upload that created it.
    """
    vendor = models.ForeignKey(
        'vendor.Vendor',
        on_delete=models.CASCADE,
        related_name="products",
        help_text="The vendor who supplies this product"
    )
    vendor_sku = models.CharField(
        max_length=255,
        help_text="Vendor's SKU/item number (used for eBay item number)"
    )
    variation_id = models.CharField(
        max_length=255, 
        blank=True,
        help_text="Product variation identifier if applicable"
    )
    marketplace_child_sku = models.CharField(
        max_length=255,
        help_text="Marketplace-specific child SKU"
    )
    marketplace_parent_sku = models.CharField(
        max_length=255, 
        blank=True,
        help_text="Marketplace-specific parent SKU"
    )
    marketplace_external_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="External ID provided by the marketplace (eBay ID, Amazon ASIN, etc.)"
    )
    marketplace = models.ForeignKey(
        'marketplace.Marketplace',
        on_delete=models.CASCADE,
        related_name="products",
        help_text="The marketplace where this product is sold"
    )
    store = models.ForeignKey(
        'marketplace.Store',
        on_delete=models.CASCADE,
        related_name="products",
        help_text="The specific store within the marketplace"
    )
    upload = models.ForeignKey(
        'Upload',
        on_delete=models.SET_NULL,
        related_name="products",
        null=True,
        blank=True,
        help_text="The upload session that created this product"
    )

    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"
        # Ensure unique combination of marketplace, store and child SKU
        unique_together = [
            ['marketplace', 'store', 'marketplace_child_sku']
        ]

    def __str__(self):
        return f"{self.vendor_sku} ({self.marketplace_child_sku})"
    
    def get_ebay_url(self):
        """
        Generate eBay URL from vendor_sku.
        
        Returns:
            str: eBay Canada URL for this product
        """
        item_number = str(self.vendor_sku).split('.')[0]
        return f"https://www.ebay.ca/itm/{item_number}"

    def is_ebay_product(self):
        """
        Check if this product is from eBayUS marketplace.
        
        Returns:
            bool: True if product is from eBayUS marketplace
        """
        return (
            self.marketplace.code == "eBayUS" or 
            self.marketplace.name == "eBayUS"
        )
    
    
    
class Upload(models.Model):
    id = models.BigAutoField(primary_key=True)
    original_name = models.CharField(max_length=255)
    stored_key = models.CharField(max_length=255)
    note = models.TextField()
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    job_id = models.CharField(unique=True, max_length=255, blank=True, null=True)
    processed_count = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    progress_data = models.JSONField(max_length=20, blank=True, null=True)

    class Meta:
        verbose_name = "Upload"
        verbose_name_plural = "Uploads"
        db_table = 'products_upload'
        ordering = ['-expires_at']

    def __str__(self):
        return self.original_name
    

class Scrape(models.Model):
    """
    Represents a scraping operation result for a specific product.
    
    This model stores the complete history of scraping attempts,
    including successful results and error information.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="scrapes",
        help_text="The product that was scraped"
    )
    scrape_time = models.DateTimeField(
        default=timezone.now,
        help_text="When this scraping operation occurred"
    )
    price_cents = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="Scraped price in cents (deprecated - use VendorPrice.price)"
    )
    stock = models.IntegerField(
        null=True, 
        blank=True,
        help_text="Scraped stock quantity"
    )
    error_code = models.CharField(
        max_length=50, 
        blank=True,
        help_text="Error code if scraping failed"
    )
    raw_response = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Complete raw response from scraping operation"
    )

    # Raw scraped data for audit trail
    raw_price = models.CharField(max_length=100, blank=True, help_text="Raw price text from scraping")
    raw_shipping = models.CharField(max_length=200, blank=True, help_text="Raw shipping info from scraping")
    raw_quantity = models.TextField(blank=True, help_text="Raw quantity info from scraping")
    raw_handling_time = models.TextField(blank=True, help_text="Raw handling time info from scraping")
    raw_seller_away = models.TextField(blank=True, help_text="Raw seller away info from scraping")
    raw_ended_listings = models.TextField(blank=True, help_text="Raw ended listings info from scraping")
    
    # Calculated values
    calculated_shipping_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, 
        help_text="Calculated shipping price after business rules"
    )
    final_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Final price after business rules (price + shipping)"
    )
    final_inventory = models.IntegerField(
        null=True, blank=True,
        help_text="Final inventory after business rules"
    )
    
    # Business logic flags
    needs_rescrape = models.BooleanField(
        default=False,
        help_text="Whether this product needs to be rescraped"
    )
    error_details = models.TextField(
        blank=True,
        help_text="Detailed error information for debugging"
    )

    class Meta:
        verbose_name = "Scrape"
        verbose_name_plural = "Scrapes"
        ordering = ['-scrape_time']
        indexes = [
            models.Index(fields=['product', '-scrape_time']),
            models.Index(fields=['needs_rescrape']),  # For rescrape queries
        ]

    def __str__(self):
        return f"Scrape of {self.product.vendor_sku} at {self.scrape_time}"
    

