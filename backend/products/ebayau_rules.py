import re
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, Optional
from django.utils import timezone

class eBayAUBusinessRules:
    """Business logic for processing eBayAU scraped data"""
    
    # Vendor name variations for filtering
    EBAYAU_VENDOR_VARIATIONS = [
        "eBayAU", "eBay AU", "eBay Australia", 
        "ebayau", "ebay au", "ebay australia"
    ]
    
    @staticmethod
    def is_ebayau_vendor(vendor_name: str) -> bool:
        """Check if vendor name matches eBayAU variations"""
        if not vendor_name:
            return False
        return vendor_name.lower() in [v.lower() for v in eBayAUBusinessRules.EBAYAU_VENDOR_VARIATIONS]
    
    @staticmethod
    def process_scraped_data(scraped_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply all business rules to scraped data"""
        
        # Extract raw fields
        raw_price = scraped_data.get('price', '')
        raw_shipping = scraped_data.get('shipping_info', '')
        raw_quantity = scraped_data.get('quantity', '')
        raw_handling_time = scraped_data.get('handling_time', '')
        raw_seller_away = scraped_data.get('seller_away', '')
        raw_ended_listings = scraped_data.get('ended_listings', '')
        error_status = scraped_data.get('error_status', '')
        
        # Apply business rules
        final_inventory = eBayAUBusinessRules.calculate_inventory(
            error_status, raw_handling_time, raw_seller_away, raw_ended_listings,
            raw_price, raw_quantity
        )
        
        shipping_price = eBayAUBusinessRules.calculate_shipping_price(raw_shipping)
        cleaned_price = eBayAUBusinessRules.clean_price(raw_price)
        
        # Calculate final price (cleaned price + shipping price)
        final_price = cleaned_price + shipping_price if cleaned_price else Decimal('489.99')
        
        # Validate final values
        final_inventory = eBayAUBusinessRules.validate_inventory(final_inventory)
        final_price = eBayAUBusinessRules.validate_price(final_price)
        
        # Only mark for rescrape if it's a 503 error after 3 retries
        needs_rescrape = 'Status 503' in error_status
        
        return {
            'raw_price': raw_price,
            'raw_shipping': raw_shipping,
            'raw_quantity': raw_quantity,
            'raw_handling_time': raw_handling_time,
            'raw_seller_away': raw_seller_away,
            'raw_ended_listings': raw_ended_listings,
            'calculated_shipping_price': shipping_price,
            'final_price': final_price,
            'final_inventory': final_inventory,
            'needs_rescrape': needs_rescrape,
            'error_details': error_status
        }
    
    @staticmethod
    def calculate_inventory(error_status: str, handling_time: str, seller_away: str, 
                          ended_listings: str, raw_price: str, raw_quantity: str) -> int:
        """Calculate final inventory based on business rules"""
        
        # Rule 1: "We looked everywhere" error
        if 'We looked everywhere' in error_status:
            return 0
        
        # Rule 2: Handling time > 2 days
        if 'Will usually post/ship within' in handling_time:
            time_match = re.search(r'(\d+)', handling_time)
            if time_match:
                days = int(time_match.group(1))
                if days > 2:
                    return 0
        
        # Rule 3: Seller away
        if seller_away and seller_away.strip():
            return 0
        
        # Rule 4: Ended listings
        if ended_listings and ended_listings.strip():
            return 0
        
        # Rule 5: Price doesn't contain "AU $"
        if raw_price and 'AU $' not in raw_price:
            return 0
        
        # Rule 6: Quantity info not found
        if 'Quantity info not found' in raw_quantity:
            return 0
        
        # Rule 7: Out of stock
        if 'This item is out of stock' in raw_quantity:
            return 0
        
        # Rule 8: Blank quantity
        if not raw_quantity or not raw_quantity.strip():
            return 0
        
        # Extract quantity from "Max: X" format - always use Max value
        max_match = re.search(r'Max: (\d+)', raw_quantity)
        if max_match:
            return int(max_match.group(1))
        
        return 0
    
    @staticmethod
    def calculate_shipping_price(shipping_info: str) -> Decimal:
        """Calculate shipping price from shipping info"""
        if not shipping_info:
            return Decimal('0')
        
        # Free shipping conditions
        free_conditions = [
            'Free', 'Does not ship to Australia', 'Item does not ship to you',
            'No shipping info', 'Will ship to Australia.'
        ]
        
        if any(condition in shipping_info for condition in free_conditions):
            return Decimal('0')
        
        # Clean shipping info
        cleaned = shipping_info
        cleaned = re.sub(r'\(approx[^)]*\)', '', cleaned)  # Remove (approx*)
        cleaned = re.sub(r'\*\$', '', cleaned)  # Remove *$
        
        # Extract price - look for AU $ pattern first
        price_match = re.search(r'AU \$([\d,]+\.?\d*)', cleaned)
        if price_match:
            try:
                price_str = price_match.group(1).replace(',', '')
                return Decimal(price_str)
            except (InvalidOperation, ValueError):
                pass
        
        # Fallback: look for any $ pattern
        price_match = re.search(r'\$([\d,]+\.?\d*)', cleaned)
        if price_match:
            try:
                price_str = price_match.group(1).replace(',', '')
                return Decimal(price_str)
            except (InvalidOperation, ValueError):
                pass
        
        return Decimal('0')
    
    @staticmethod
    def clean_price(price_text: str) -> Optional[Decimal]:
        """Clean and extract price"""
        if not price_text:
            return Decimal('489.99')
        
        # Remove currency symbols
        cleaned = price_text.replace('AU $', '').replace('US $', '').replace('EUR $', '')
        
        # Extract decimal value
        price_match = re.search(r'([\d,]+\.?\d*)', cleaned)
        if price_match:
            try:
                price_str = price_match.group(1).replace(',', '')
                return Decimal(price_str)
            except (InvalidOperation, ValueError):
                pass
        
        return Decimal('489.99')
    
    @staticmethod
    def validate_inventory(inventory: int) -> int:
        """Validate inventory is a non-negative integer"""
        try:
            inventory_int = int(inventory)
            return max(0, inventory_int)  # Ensure non-negative
        except (ValueError, TypeError):
            return 0
    
    @staticmethod
    def validate_price(price: Decimal) -> Decimal:
        """Validate price is a valid decimal"""
        try:
            if price and price > 0:
                return price
            else:
                return Decimal('489.99')
        except (InvalidOperation, TypeError):
            return Decimal('489.99') 