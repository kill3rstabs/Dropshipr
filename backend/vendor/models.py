from django.db import models
from django.utils import timezone

# Create your models here.
class Vendor(models.Model):
    code = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name
    
    
class VendorPrice(models.Model):
    """
    Latest scraped price+stock per product.
    Replaces the Postgres UNIQUE index on scrapes(product_id).
    """
    product = models.OneToOneField('products.Product', on_delete=models.CASCADE, related_name="latest_price")
    price_cents = models.PositiveIntegerField(null=True, blank=True)
    stock = models.IntegerField(null=True, blank=True)
    error_code = models.CharField(max_length=50, blank=True)
    scraped_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Latest price for {self.product_id}"

