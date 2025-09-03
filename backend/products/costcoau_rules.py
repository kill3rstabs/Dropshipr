from decimal import Decimal, InvalidOperation
from typing import Dict, Any
import re


class CostcoAUBusinessRules:
    """Business logic for processing Costco AU scraped data"""

    @staticmethod
    def _clean_price_to_decimal(price_text: str) -> Decimal:
        if not price_text or str(price_text).strip() == "":
            return Decimal('489.99')
        cleaned = re.sub(r'[^\d.]', '', str(price_text))
        try:
            return Decimal(cleaned) if cleaned else Decimal('489.99')
        except (InvalidOperation, ValueError):
            return Decimal('489.99')

    @staticmethod
    def process_scraped_data(scraped: Dict[str, Any]) -> Dict[str, Any]:
        raw_price = scraped.get('Price') or ''
        raw_add_to_cart = scraped.get('Add to Cart Text') or ''
        raw_item_number = scraped.get('Item Number') or ''
        raw_price_currency = scraped.get('Price Currency') or ''
        raw_max_qty = scraped.get('Maximum Quantity') or ''
        raw_title = scraped.get('Title') or ''
        url = scraped.get('URL') or ''

        final_price = CostcoAUBusinessRules._clean_price_to_decimal(raw_price)

        inv_text = str(raw_add_to_cart).strip().lower()
        if (not inv_text) or ('out of stock' in inv_text):
            final_inventory = 0
        elif 'add to cart' in inv_text:
            final_inventory = 3
        else:
            final_inventory = 0

        return {
            'raw_price': raw_price,
            'raw_quantity': raw_add_to_cart,
            'raw_shipping': '',
            'raw_handling_time': '',
            'raw_seller_away': '',
            'raw_ended_listings': '',
            'final_price': final_price,
            'final_inventory': final_inventory,
            'calculated_shipping_price': Decimal('0'),
            'needs_rescrape': False,
            'error_details': '',
            'item_number': raw_item_number,
            'price_currency': raw_price_currency,
            'max_quantity': raw_max_qty,
            'title': raw_title,
            'url': url,
        } 