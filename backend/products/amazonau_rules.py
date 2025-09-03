from decimal import Decimal, InvalidOperation
from typing import Dict, Any, Optional
from datetime import datetime
import re


class AmazonAUBusinessRules:
    """Business logic for processing AmazonAU scraped data"""

    @staticmethod
    def _clean_price_to_decimal(price_text: str) -> Optional[Decimal]:
        if not price_text or str(price_text).strip().lower() in ["n/a", "na", "none", "null", ""]:
            return Decimal('489.99')
        cleaned = re.sub(r'[^\d.]', '', str(price_text))
        try:
            return Decimal(cleaned) if cleaned else Decimal('489.99')
        except (InvalidOperation, ValueError):
            return Decimal('489.99')

    @staticmethod
    def _parse_datetime(dt_str: str) -> Optional[datetime]:
        if not dt_str:
            return None
        for fmt in ['%m-%d-%Y / %I:%M %p', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
            try:
                return datetime.strptime(dt_str, fmt)
            except Exception:
                continue
        return None

    @staticmethod
    def _extract_days_from_text(text: str) -> Optional[int]:
        if not text:
            return None
        m = re.search(r'(\d+)', text)
        return int(m.group(1)) if m else None

    @staticmethod
    def process_scraped_data(scraped: Dict[str, Any]) -> Dict[str, Any]:
        raw_price = scraped.get('Main Price') or ''
        raw_inventory = scraped.get('Inventory') or ''
        raw_currently_unavailable = scraped.get('Currently Unavailable') or ''
        raw_shipping_date = scraped.get('Shipping Date') or ''
        raw_ship_by = scraped.get('Ship By') or ''
        raw_sold_by = scraped.get('Sold By') or ''
        raw_import = scraped.get('Import') or ''
        raw_scrape_time = scraped.get('Scrape Time') or ''
        raw_handling_time = scraped.get('Handling Time') or ''

        final_price = AmazonAUBusinessRules._clean_price_to_decimal(raw_price)
        final_inventory = 0

        if 'imports may differ from local products' in raw_import.lower():
            final_inventory = 0
        elif raw_ship_by and 'amazon' not in raw_ship_by.lower():
            final_inventory = 0
        else:
            days = AmazonAUBusinessRules._extract_days_from_text(raw_handling_time)
            if days is not None and days > 2:
                final_inventory = 0
            else:
                greater_than_7 = False
                if raw_shipping_date:
                    m = re.search(r'(\d+)\s+day', raw_shipping_date.lower())
                    if m:
                        try:
                            if int(m.group(1)) > 7:
                                greater_than_7 = True
                        except Exception:
                            pass
                if greater_than_7:
                    final_inventory = 0
                else:
                    inv_text = f"{raw_inventory} {raw_currently_unavailable}".lower().strip()
                    if (not inv_text) or any(p in inv_text for p in [
                        'currently unavailable', 'usually dispatched within', 'temporarily out of stock', 'n/a'
                    ]):
                        final_inventory = 0
                    elif 'only' in inv_text:
                        final_inventory = 1
                    elif 'in stock' in inv_text:
                        final_inventory = 3
                    else:
                        final_inventory = 0

        try:
            final_inventory = max(0, int(final_inventory))
        except Exception:
            final_inventory = 0

        try:
            if not final_price or final_price <= 0:
                final_price = Decimal('489.99')
        except Exception:
            final_price = Decimal('489.99')

        return {
            'raw_price': raw_price,
            'raw_quantity': raw_inventory,
            'raw_shipping': f"Ship By: {raw_ship_by} | Shipping Date: {raw_shipping_date}".strip(),
            'raw_handling_time': raw_handling_time,
            'raw_seller_away': '',
            'raw_ended_listings': '',
            'final_price': final_price,
            'final_inventory': final_inventory,
            'calculated_shipping_price': Decimal('0'),
            'needs_rescrape': False,
            'error_details': scraped.get('error_status', '') or ''
        } 