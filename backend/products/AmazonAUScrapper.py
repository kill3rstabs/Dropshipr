from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import asyncio
import aiohttp
import random
import re
import pytz

from django.db import transaction
from django.utils import timezone
from bs4 import BeautifulSoup

from .models import Product, Scrape
from vendor.models import VendorPrice
from .amazonau_rules import AmazonAUBusinessRules


class AmazonAUScrapper:
    AMAZONAU_MAX_CONCURRENT_REQUESTS = 10
    AMAZONAU_BATCH_SIZE = 25
    AMAZONAU_TIMEOUT = aiohttp.ClientTimeout(total=30)
    AMAZONAU_RETRY_LIMIT = 2

    AMAZON_USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    ]

    @staticmethod
    def build_vendor_groups(products: List[Product]) -> Tuple[List[Product], Dict[int, List[int]]]:
        key_to_ids: Dict[Tuple[int, str], List[int]] = defaultdict(list)
        rep_map: Dict[Tuple[int, str], Product] = {}
        for p in products:
            key = (p.vendor_id, str(p.vendor_sku).strip())
            key_to_ids[key].append(p.id)
            if key not in rep_map:
                rep_map[key] = p
        reps = list(rep_map.values())
        rep_to_ids: Dict[int, List[int]] = {rep.id: key_to_ids[(rep.vendor_id, str(rep.vendor_sku).strip())] for rep in reps}
        return reps, rep_to_ids

    @staticmethod
    def build_amazon_au_url(product: Product) -> Optional[str]:
        sku = str(product.vendor_sku).strip()
        return f"https://www.amazon.com.au/dp/{sku}" if sku else None

    @staticmethod
    def parse_amazonau_details_from_soup(soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        main_price = "N/A"
        price_div = soup.select_one("div.a-section.aok-hidden.twister-plus-buying-options-price-data")
        if price_div:
            try:
                import json as _json
                json_data = _json.loads(price_div.get_text(strip=True))
                main_price = json_data.get('desktop_buybox_group_1', [{}])[0].get('displayPrice', 'N/A')
            except Exception:
                main_price = "N/A"
        if main_price == "N/A":
            visible_price = soup.select_one("#corePrice_feature_div span.a-offscreen")
            if visible_price:
                main_price = visible_price.get_text(strip=True)

        inv_el = soup.select_one("#availability span")
        inventory = inv_el.get_text(strip=True) if inv_el else "N/A"

        cu = soup.select_one("span.a-color-price.a-text-bold, .a-spacing-base a.a-button-text")
        currently_unavailable = cu.get_text(strip=True) if cu else ("In Stock" if 'in stock' in inventory.lower() else 'N/A')

        ship_date_el = soup.select_one("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE span.a-text-bold")
        shipping_date = ship_date_el.get_text(strip=True) if ship_date_el else "N/A"

        ship_by_el = soup.select_one("#fulfillerInfoFeature_feature_div span.offer-display-feature-text-message")
        ship_by = ship_by_el.get_text(strip=True) if ship_by_el else "N-A"

        sold_by_el = soup.select_one(".offer-display-feature-text-message a")
        sold_by = sold_by_el.get_text(strip=True) if sold_by_el else "N-A"

        import_el = soup.select_one("#globalStoreBadgePopoverInsideBuybox_feature_div div.a-section")
        import_info = import_el.get_text(strip=True) if import_el else "N-A"

        handling_el = soup.find(string=re.compile(r'Usually (?:ships|dispatched) within', re.IGNORECASE))
        handling_time = handling_el.strip() if handling_el else ""

        pakistan_tz = pytz.timezone('Asia/Karachi')
        scrape_time = datetime.now(pakistan_tz).strftime('%m-%d-%Y / %I:%M %p')

        return {
            "URL": url,
            "Main Price": main_price,
            "Inventory": inventory,
            "Currently Unavailable": currently_unavailable,
            "Shipping Date": shipping_date,
            "Ship By": ship_by,
            "Sold By": sold_by,
            "Import": import_info,
            "Handling Time": handling_time,
            "Scrape Time": scrape_time
        }

    @classmethod
    async def scrape_single(cls, product: Product, session: aiohttp.ClientSession, retries: int = 0) -> Dict[str, Any]:
        url = cls.build_amazon_au_url(product)
        headers = {
            'User-Agent': random.choice(cls.AMAZON_USER_AGENTS),
            'Accept-Language': 'en-AU,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
        error_output = ""
        details: Dict[str, Any] = {}
        if not url:
            return {'product_id': product.id, 'success': False, 'error_status': 'Missing vendor_sku for URL'}
        try:
            async with session.get(url, timeout=cls.AMAZONAU_TIMEOUT, headers=headers) as response:
                text = await response.text()
                if response.status >= 500:
                    error_output = f"Status {response.status}"
                elif 'captcha' in text.lower() or 'enter the characters you see below' in text.lower():
                    error_output = "Blocked by CAPTCHA"
                else:
                    soup = BeautifulSoup(text, 'html.parser')
                    details = cls.parse_amazonau_details_from_soup(soup, url)
        except asyncio.TimeoutError:
            if retries < cls.AMAZONAU_RETRY_LIMIT:
                await asyncio.sleep(1 + retries)
                return await cls.scrape_single(product, session, retries + 1)
            error_output = f"Request timed out for {url}"
        except aiohttp.ClientError as e:
            if retries < cls.AMAZONAU_RETRY_LIMIT:
                await asyncio.sleep(1 + retries)
                return await cls.scrape_single(product, session, retries + 1)
            error_output = f"Client error for {url}: {str(e)}"
        except Exception as e:
            error_output = f"Unexpected error for {url}: {str(e)}"

        return {
            'product_id': product.id,
            'vendor_sku': product.vendor_sku,
            'url': url,
            'success': not bool(error_output),
            'error_status': error_output,
            **details
        }

    @classmethod
    async def process_batch(cls, products_batch: List[Product], session: aiohttp.ClientSession) -> List[Dict[str, Any]]:
        tasks = [cls.scrape_single(p, session) for p in products_batch]
        return await asyncio.gather(*tasks)

    @classmethod
    @transaction.atomic
    def save_results(cls, results: List[Dict[str, Any]]) -> None:
        tz_now = timezone.now()
        for r in results:
            try:
                product = Product.objects.get(id=r.get('product_id'))
            except Product.DoesNotExist:
                continue
            except Exception:
                continue

            processed = AmazonAUBusinessRules.process_scraped_data({
                'Main Price': r.get('Main Price'),
                'Inventory': r.get('Inventory'),
                'Currently Unavailable': r.get('Currently Unavailable'),
                'Shipping Date': r.get('Shipping Date'),
                'Ship By': r.get('Ship By'),
                'Sold By': r.get('Sold By'),
                'Import': r.get('Import'),
                'Handling Time': r.get('Handling Time', ''),
                'Scrape Time': r.get('Scrape Time'),
                'error_status': r.get('error_status', '')
            })

            Scrape.objects.create(
                product=product,
                scrape_time=tz_now,
                raw_response=r,
                error_code=processed['error_details'],
                raw_price=processed['raw_price'],
                raw_shipping=processed['raw_shipping'],
                raw_quantity=processed['raw_quantity'],
                raw_handling_time=processed['raw_handling_time'],
                raw_seller_away=processed['raw_seller_away'],
                raw_ended_listings=processed['raw_ended_listings'],
                calculated_shipping_price=processed['calculated_shipping_price'],
                final_price=processed['final_price'],
                final_inventory=processed['final_inventory'],
                needs_rescrape=processed['needs_rescrape'],
                error_details=processed['error_details']
            )

            VendorPrice.objects.update_or_create(
                product=product,
                defaults={
                    'price': processed['final_price'],
                    'stock': processed['final_inventory'],
                    'error_code': processed['error_details'],
                    'scraped_at': tz_now
                }
            ) 