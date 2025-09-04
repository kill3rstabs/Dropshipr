from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import asyncio
import aiohttp
import random
import re
import pytz
import logging

from django.db import transaction
from django.utils import timezone
from bs4 import BeautifulSoup

from .models import Product, Scrape
from vendor.models import VendorPrice
from .amazonau_rules import AmazonAUBusinessRules

# Selenium imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
# Amazon captcha solver
from amazoncaptcha import AmazonCaptcha


logger = logging.getLogger(__name__)

class AmazonAUScrapper:
    AMAZONAU_MAX_CONCURRENT_REQUESTS = 10
    AMAZONAU_BATCH_SIZE = 25
    AMAZONAU_TIMEOUT = aiohttp.ClientTimeout(total=30)
    AMAZONAU_RETRY_LIMIT = 5
    AMAZON_AU_BASE = "https://www.amazon.com.au"
    AMAZON_ZIP = "2762"

    AMAZON_USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    ]

    @classmethod
    def create_driver(cls) -> webdriver.Chrome:
        options = Options()
        # Headless is recommended in server
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1280,1696')
        options.add_argument('--disable-gpu')
        options.add_argument('--start-maximized')
        options.add_argument('--lang=en-AU')
        # Stabilize
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-infobars')
        driver = webdriver.Chrome(options=options)
        logger.info("Selenium Chrome driver created")
        return driver

    @classmethod
    def solve_captcha_if_present(cls, driver: webdriver.Chrome):
        try:
            img = driver.find_element(By.XPATH, "//div[@class='a-row a-text-center']//img")
            link = img.get_attribute('src')
            captcha = AmazonCaptcha.fromlink(link)
            value = captcha.solve()
            input_field = driver.find_element(By.ID, "captchacharacters")
            input_field.clear()
            input_field.send_keys(value)
            button = driver.find_element(By.CLASS_NAME, "a-button-text")
            button.click()
            logger.info("Solved CAPTCHA via amazoncaptcha")
        except Exception:
            # No captcha or solver failed; continue silently
            pass

    @classmethod
    def set_zip_code(cls, driver: webdriver.Chrome) -> bool:
        try:
            driver.get(cls.AMAZON_AU_BASE)
            cls.solve_captcha_if_present(driver)
            wait = WebDriverWait(driver, 15)
            popover_trigger = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a.a-popover-trigger")))
            popover_trigger.click()
            cls.solve_captcha_if_present(driver)
            # Wait for the postal code input to be visible
            postal_code_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input.GLUX_Full_Width"))
            )
            postal_code_input.clear()
            postal_code_input.send_keys("2762")
            time.sleep(random.uniform(1, 3))

            apply_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCityApplyButton input")))
            apply_button.click()

            # City confirmation
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "span#GLUXPostalCodeWithCity_CityValue")))

            dropdown_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCity_DropdownButton span.a-button-text")))
            dropdown_button.click()

            dropdown_item = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a#GLUXPostalCodeWithCity_DropdownList_0")))
            dropdown_item.click()

            apply_button_again = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCityApplyButton input")))
            apply_button_again.click()

            logger.info(f"Selenium: Postal code set to {cls.AMAZON_ZIP}")
            return True
        except Exception as e:
            logger.error(f"Error setting postal code via Selenium: {e}")
            return False

    @staticmethod
    def build_vendor_groups(products: List[Product]) -> Tuple[List[Product], Dict[int, List[int]]]:
        start = timezone.now()
        logger.info(f"Building vendor groups for {len(products)} AmazonAU products")
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
            except Exception as e:
                logger.debug(f"Failed to parse hidden price JSON for {url}: {e}")
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
    def extract_data_with_driver(cls, url: str, driver: webdriver.Chrome) -> Dict[str, Any]:
        try:
            driver.get(url)
            cls.solve_captcha_if_present(driver)
            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            # Detect 500 errors
            if 'HTTP ERROR 500' in html or 'Internal Server Error' in html:
                return { 'error_status': 'Status 500' }
            details = cls.parse_amazonau_details_from_soup(soup, url)
            details['error_status'] = ''
            return details
        except Exception as e:
            logger.error(f"Selenium extract error for {url}: {e}")
            return { 'error_status': f"Exception: {e}" }

    @classmethod
    async def scrape_single(cls, product: Product, driver: webdriver.Chrome, retries: int = 0) -> Dict[str, Any]:
        url = cls.build_amazon_au_url(product)
        if not url:
            logger.warning(f"Product {product.id} missing vendor_sku; cannot build AmazonAU URL")
            return {'product_id': product.id, 'success': False, 'error_status': 'Missing vendor_sku for URL'}

        logger.info(f"Scrape start: product_id={product.id} sku={product.vendor_sku} retries={retries}")
        data = cls.extract_data_with_driver(url, driver)
        error_output = data.get('error_status') or ''

        # Retry on server errors/timeouts markers
        if error_output.startswith('Status 500') and retries < cls.AMAZONAU_RETRY_LIMIT - 1:
            delay = (2 ** retries) + random.uniform(0.5, 1.5)
            logger.warning(f"5xx server error for product_id={product.id}; retry {retries+1}/{cls.AMAZONAU_RETRY_LIMIT} after {delay:.2f}s")
            await asyncio.sleep(delay)
            return await cls.scrape_single(product, driver, retries + 1)

        success = not bool(error_output)
        result = {
            'product_id': product.id,
            'vendor_sku': product.vendor_sku,
            'url': url,
            'success': success,
            'error_status': error_output,
        }
        if success:
            result.update(data)
        logger.info(f"Scrape end: product_id={product.id} success={success} error={error_output if error_output else 'none'}")
        return result

    @classmethod
    async def process_batch(cls, products_batch: List[Product], driver: webdriver.Chrome) -> List[Dict[str, Any]]:
        logger.info(f"Batch scrape start for {len(products_batch)} representatives (selenium)")
        t0 = timezone.now()
        results: List[Dict[str, Any]] = []
        for p in products_batch:
            res = await cls.scrape_single(p, driver)
            results.append(res)
        ok = sum(1 for r in results if r.get('success'))
        logger.info(f"Batch scrape end: success={ok} failed={len(results)-ok} elapsed={(timezone.now()-t0).total_seconds():.2f}s")
        return results

    @classmethod
    @transaction.atomic
    def save_results(cls, results: List[Dict[str, Any]]) -> None:
        logger.info(f"Saving {len(results)} AmazonAU results to DB")
        tz_now = timezone.now()
        saved = 0
        for r in results:
            try:
                product = Product.objects.get(id=r.get('product_id'))
            except Product.DoesNotExist:
                logger.error(f"Save skip: product {r.get('product_id')} not found")
                continue
            except Exception as e:
                logger.error(f"Save skip: error loading product {r.get('product_id')}: {e}")
                continue

            # If no success, at least log the error scrape
            if not r.get('success'):
                Scrape.objects.create(
                    product=product,
                    scrape_time=tz_now,
                    raw_response=r,
                    error_code=r.get('error_status',''),
                    error_details=r.get('error_status','')
                )
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
            saved += 1
        logger.info(f"Saved {saved}/{len(results)} results to DB") 