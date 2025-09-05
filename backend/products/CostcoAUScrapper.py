from typing import List, Dict, Any, Tuple
import asyncio
import aiohttp
import logging
import re
import random
from collections import defaultdict
from bs4 import BeautifulSoup

from django.db import transaction
from django.utils import timezone

from .models import Product, Scrape
from vendor.models import VendorPrice
from .costcoau_rules import CostcoAUBusinessRules


logger = logging.getLogger(__name__)


class CostcoAUScrapper:
    COSTCOAU_MAX_CONCURRENT_REQUESTS = 2  # Reduced from 5 to 2
    COSTCOAU_BATCH_SIZE = 10  # Reduced from 25 to 10
    COSTCOAU_TIMEOUT = aiohttp.ClientTimeout(total=30)  # Reduced from 60 to 30
    COSTCOAU_RETRY_LIMIT = 1  # Reduced from 2 to 1

    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    ]

    @staticmethod
    def build_vendor_groups(products: List[Product]) -> Tuple[List[Product], Dict[int, List[int]]]:
        start = timezone.now()
        logger.info(f"Building vendor groups for {len(products)} CostcoAU products")
        key_to_ids: Dict[Tuple[int, str], List[int]] = defaultdict(list)
        rep_map: Dict[Tuple[int, str], Product] = {}
        for p in products:
            key = (p.vendor_id, str(p.vendor_sku).strip())
            key_to_ids[key].append(p.id)
            if key not in rep_map:
                rep_map[key] = p
        reps = list(rep_map.values())
        rep_to_ids: Dict[int, List[int]] = {rep.id: key_to_ids[(rep.vendor_id, str(rep.vendor_sku).strip())] for rep in reps}
        logger.info(f"Built {len(reps)} representative groups in {(timezone.now()-start).total_seconds():.2f}s")
        return reps, rep_to_ids

    @staticmethod
    def build_costco_au_url(product: Product) -> str:
        sku = str(product.vendor_sku).strip()
        return f"https://www.costco.com.au/p/{sku}"

    @staticmethod
    def parse_costcoau_details_from_soup(soup: BeautifulSoup, url: str, response_text: str) -> Dict[str, Any]:
        # Extract title
        title_el = soup.select_one('h1')
        title = title_el.get_text(strip=True) if title_el else ''

        # Extract item number
        item_el = soup.select_one('p.product-code')
        item_number = item_el.get_text(strip=True) if item_el else ''

        # Extract price from meta tag
        price_meta = soup.select_one('meta[property="product:price:amount"]')
        price = price_meta['content'] if price_meta and price_meta.has_attr('content') else ''

        # Extract price currency from meta tag
        price_currency_meta = soup.select_one('meta[property="product:price:currency"]')
        price_currency = price_currency_meta['content'] if price_currency_meta and price_currency_meta.has_attr('content') else ''

        # Extract Add to Cart text (exactly like your scraper)
        add_btn = soup.select_one('button.btn-block')
        add_to_cart_text = add_btn.get_text(strip=True) if add_btn else ''
        if not add_to_cart_text:
            add_btn_fallback = soup.select_one('button.notranslate')
            add_to_cart_text = add_btn_fallback.get_text(strip=True) if add_btn_fallback else ''

        # Extract maximum quantity (exactly like your scraper - using response_text)
        max_quantity = ''
        match1 = re.search(r';maximum\.quantity\.addtocart&q;:&q;(\d+)&q;', response_text)
        if match1:
            max_quantity = match1.group(1)
        else:
            match2 = re.search(r'Costco\.config\.addToCartMaxQty\s*=\s*"(\d+)"', response_text)
            if match2:
                max_quantity = match2.group(1)

        return {
            'URL': url,
            'Title': title,
            'Item Number': item_number,
            'Price': price,
            'Price Currency': price_currency,
            'Add to Cart Text': add_to_cart_text,
            'Maximum Quantity': max_quantity,
        }

    @classmethod
    async def scrape_single(cls, product: Product, session: aiohttp.ClientSession, retries: int = 0) -> Dict[str, Any]:
        url = cls.build_costco_au_url(product)
        
        # Add delay between requests to avoid rate limiting
        await asyncio.sleep(random.uniform(2, 5))
        
        # More realistic browser headers
        headers = {
            'User-Agent': cls.USER_AGENTS[retries % len(cls.USER_AGENTS)],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-AU,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
        }
        
        error_output = ""
        details: Dict[str, Any] = {}
        
        try:
            start = timezone.now()
            async with session.get(url, timeout=cls.COSTCOAU_TIMEOUT, headers=headers) as response:
                text = await response.text()
                status = response.status
                elapsed = (timezone.now()-start).total_seconds()
                logger.info(f"CostcoAU fetch: product_id={product.id} status={status} elapsed={elapsed:.2f}s")
                
                if status == 200:
                    soup = BeautifulSoup(text, 'html.parser')
                    details = cls.parse_costcoau_details_from_soup(soup, url, text)
                elif status >= 500:
                    error_output = f"Status {status}"
                else:
                    error_output = f"Status {status}"
                    
        except asyncio.TimeoutError:
            if retries < cls.COSTCOAU_RETRY_LIMIT:
                await asyncio.sleep(5 + retries * 2)  # Longer delay between retries
                return await cls.scrape_single(product, session, retries + 1)
            error_output = "Request timed out"
            logger.warning(f"CostcoAU timeout: product_id={product.id} url={url}")
            
        except aiohttp.ClientError as e:
            if retries < cls.COSTCOAU_RETRY_LIMIT:
                await asyncio.sleep(5 + retries * 2)
                return await cls.scrape_single(product, session, retries + 1)
            error_output = f"Client error: {str(e)}"
            logger.warning(f"CostcoAU client error: product_id={product.id} error={e}")
            
        except Exception as e:
            logger.error(f"CostcoAU unexpected error for product_id={product.id}: {e}", exc_info=True)
            error_output = f"Unexpected error: {str(e)}"

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
        # Use semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(cls.COSTCOAU_MAX_CONCURRENT_REQUESTS)
        
        async def scrape_with_semaphore(product):
            async with semaphore:
                return await cls.scrape_single(product, session)
        
        tasks = [scrape_with_semaphore(p) for p in products_batch]
        return await asyncio.gather(*tasks)

    @classmethod
    def save_results(cls, results: List[Dict[str, Any]]) -> None:
        from django.db import connection
        
        logger.info(f"Saving {len(results)} CostcoAU results to DB")
        
        # Check and refresh DB connection if needed
        try:
            connection.ensure_connection()
        except Exception as e:
            logger.warning(f"DB connection issue, reconnecting: {e}")
            connection.close()
            connection.ensure_connection()
        
        tz_now = timezone.now()
        saved = 0
        
        # Process in smaller chunks to avoid long transactions
        chunk_size = 5
        for i in range(0, len(results), chunk_size):
            chunk = results[i:i + chunk_size]
            
            try:
                with transaction.atomic():
                    for r in chunk:
                        try:
                            product = Product.objects.get(id=r.get('product_id'))
                        except Product.DoesNotExist:
                            logger.error(f"Save skip: product {r.get('product_id')} not found")
                            continue
                        except Exception as e:
                            logger.error(f"Save skip: error loading product {r.get('product_id')}: {e}")
                            continue

                        processed = CostcoAUBusinessRules.process_scraped_data({
                            'URL': r.get('URL'),
                            'Title': r.get('Title'),
                            'Item Number': r.get('Item Number'),
                            'Price': r.get('Price'),
                            'Price Currency': r.get('Price Currency'),
                            'Add to Cart Text': r.get('Add to Cart Text'),
                            'Maximum Quantity': r.get('Maximum Quantity'),
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
                        saved += 1
                        
            except Exception as chunk_error:
                logger.error(f"Error saving chunk {i}-{i+chunk_size}: {chunk_error}")
                # Try to reconnect for next chunk
                try:
                    connection.close()
                    connection.ensure_connection()
                except Exception:
                    pass
        
        logger.info(f"Saved {saved}/{len(results)} CostcoAU results to DB")