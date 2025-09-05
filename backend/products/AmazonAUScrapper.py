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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys


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

    ADDRESS_EDIT_PATH = "/gp/glow/get-address-selections.html"

    @classmethod
    def create_driver(cls) -> webdriver.Chrome:
        options = Options()
        # Headless is recommended in server
        options.add_argument('--window-size=6000,7100')  
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        # options.add_argument('--window-size=1280,1696')
        options.add_argument('--disable-gpu')
        options.add_argument('--start-maximized')
        options.add_argument(f'--force-device-scale-factor={0.6}')
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
    def _safe_click(cls, driver, elem):
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem)
            try:
                elem.click()
            except Exception:
                driver.execute_script("arguments[0].click();", elem)
            return True
        except Exception:
            return False
        
    @classmethod
    def set_zoom(cls, driver: webdriver.Chrome, target: float = 0.5) -> None:
        """
        Tries, in order:
        1) CDP Emulation.setPageScaleFactor (best in headless)
        2) Keyboard zoom (Ctrl+0, then Ctrl+- N times) for non-headless
        3) CSS transform fallback (with width compensation)
        Re-apply this after each navigation.
        """
        # --- 1) CDP page scale ---
        try:
            size = driver.get_window_size()
            # Ensure metrics are set before scaling
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "mobile": False,
                "width": size.get("width", 1600),
                "height": size.get("height", 2200),
                "deviceScaleFactor": 1,
                "screenWidth": size.get("width", 1600),
                "screenHeight": size.get("height", 2200),
                "positionX": 0,
                "positionY": 0,
            })
            driver.execute_cdp_cmd("Emulation.setPageScaleFactor", {"pageScaleFactor": target})
            time.sleep(0.1)
            return
        except Exception as e:
            logger.debug(f"CDP zoom failed: {e}")

        # --- 2) Keyboard zoom (non-headless typical) ---
        try:
            # Focus the <html> so zoom shortcuts work
            html = driver.find_element(By.TAG_NAME, "html")
            actions = ActionChains(driver)

            # Reset to 100%
            actions.key_down(Keys.CONTROL).send_keys("0").key_up(Keys.CONTROL).perform()
            time.sleep(0.05)

            # Chrome zoom steps: 100 → 90 → 80 → 67 → 50 → 33 → 25
            # To reach 50% from 100%, press Ctrl+- 5 times
            for _ in range(5):
                actions.key_down(Keys.CONTROL).send_keys("-").key_up(Keys.CONTROL).perform()
                time.sleep(0.05)
            return
        except Exception as e:
            logger.debug(f"Keyboard zoom failed: {e}")

        # --- 3) CSS fallback ---
        try:
            # Scale the layout and compensate width so content fits viewport
            driver.execute_script("""
                (function(s){
                    document.documentElement.style.zoom = '';
                    document.body.style.transformOrigin = '0 0';
                    document.body.style.transform = 'scale(' + s + ')';
                    document.body.style.width = (100 / s) + '%';
                })(arguments[0]);
            """, target)
            time.sleep(0.05)
        except Exception as e:
            logger.debug(f"CSS zoom fallback failed: {e}")

    @classmethod
    def set_zip_code_on_product_page(cls, driver: webdriver.Chrome, product_url: str) -> bool:
        """Set ZIP code on a product page where the location selector is available"""
        try:
            driver.get(product_url)
            cls.set_zoom(driver, 0.5)
            cls.solve_captcha_if_present(driver)
            wait = WebDriverWait(driver, 20)

            # Accept cookie banner if present
            try:
                consent = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#sp-cc-accept, input#sp-cc-accept, button#sp-cc-accept")))
                cls._safe_click(driver, consent)
                logger.info("Selenium: accepted cookie consent")
            except Exception:
                pass

            # Look for location selector on product page - try multiple selectors
            location_selectors = [
                "#contextualIngressPt",  # Common location selector on product pages
                "#glow-ingress-block",   # Alternative location block
                "a[data-csa-c-content-id='nav_cs_1']",  # Navigation location link
                "#nav-global-location-popover-link",    # Header location link
                "a.a-popover-trigger"   # Generic popover trigger
            ]

            location_clicked = False
            for selector in location_selectors:
                try:
                    location_element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                    cls._safe_click(driver, location_element)
                    time.sleep(random.uniform(2, 4))
                    location_clicked = True
                    logger.info(f"Selenium: clicked location selector: {selector}")
                    break
                except Exception:
                    continue

            if not location_clicked:
                logger.warning("Selenium: no location selector found on product page")
                return False

            cls.solve_captcha_if_present(driver)

            # Enter the postal code using provided selector, with fallback to explicit input id
            zip_input = None
            for by, sel in [
                (By.CSS_SELECTOR, "input.GLUX_Full_Width"),
                (By.CSS_SELECTOR, "#GLUXPostalCodeWithCity_PostalCodeInput"),
                (By.CSS_SELECTOR, "input[placeholder*='postal']"),
                (By.CSS_SELECTOR, "input[placeholder*='zip']"),
            ]:
                try:
                    zip_input = wait.until(EC.presence_of_element_located((by, sel)))
                    break
                except Exception:
                    continue

            if not zip_input:
                # Already set zip? check header line 2
                try:
                    line2 = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#glow-ingress-line2")))
                    logger.info(f"Selenium: location line2 present: {line2.text}")
                    return True
                except Exception:
                    logger.error("Selenium: postcode input not found on product page")
                    return False

            zip_input.clear()
            zip_input.send_keys(cls.AMAZON_ZIP)
            time.sleep(random.uniform(1, 3))

            # Click the apply button (as provided), with fallback variant
            try:
                apply_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCityApplyButton input")))
                cls._safe_click(driver, apply_button)
            except Exception:
                try:
                    apply_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCityApplyButton .a-button-input")))
                    cls._safe_click(driver, apply_button)
                except Exception:
                    logger.warning("Selenium: could not click first apply button")
            time.sleep(random.uniform(2, 4))
            cls.solve_captcha_if_present(driver)

            # Wait for the city value to be displayed (as provided)
            try:
                city_value = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "span#GLUXPostalCodeWithCity_CityValue")))
                logger.info(f"Selenium: City value after ZIP: {city_value.text}")
            except Exception:
                logger.warning("Selenium: city value not visible; continuing")

            # Click on the dropdown button and select first option (as provided), with fallbacks
            try:
                dropdown_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCity_DropdownButton span.a-button-text")))
                cls._safe_click(driver, dropdown_button)
                time.sleep(random.uniform(2, 4))
                try:
                    dropdown_item = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a#GLUXPostalCodeWithCity_DropdownList_0")))
                except Exception:
                    dropdown_item = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".a-popover-wrapper .a-popover-inner .a-dropdown-container li a, .a-popover-wrapper .a-popover-inner ul li a")))
                cls._safe_click(driver, dropdown_item)
                time.sleep(random.uniform(2, 4))
            except Exception as e:
                logger.warning(f"Selenium: could not select city option: {e}")

            # Click the apply button again (as provided)
            try:
                apply_button_again = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#GLUXPostalCodeWithCityApplyButton input")))
                cls._safe_click(driver, apply_button_again)
                time.sleep(random.uniform(2, 4))
            except Exception:
                logger.warning("Selenium: could not click second apply button")

            # Reload the page 2 times after setting ZIP code to ensure it takes effect
            logger.info("Reloading page 2 times after ZIP code change...")
            for reload_count in range(2):
                try:
                    driver.refresh()
                    cls.set_zoom(driver, 0.5)
                    time.sleep(random.uniform(2, 3))
                    cls.solve_captcha_if_present(driver)
                    logger.info(f"Page reload {reload_count + 1}/2 completed")
                except Exception as e:
                    logger.warning(f"Error during reload {reload_count + 1}: {e}")

            logger.info(f"Selenium: Postal code set to {cls.AMAZON_ZIP} on product page and page reloaded 2 times")
            return True
        except Exception as e:
            # Dump minimal debug info
            try:
                title = driver.title
            except Exception:
                title = "<no title>"
            logger.error(f"Error setting postal code on product page: {e} | title={title}")
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

        # Inventory: use provided selectors first, then fallback to previous
        inv_text_el = soup.select_one("span.a-color-price.a-text-bold,div.a-spacing-base.a-spacing-top-micro")
        if inv_text_el:
            inventory = inv_text_el.get_text(strip=True)
        else:
            inv_el = soup.select_one("#availability span")
            inventory = inv_el.get_text(strip=True) if inv_el else "N/A"

        # Currently unavailable: provided selectors with default "In Stock"
        cu_el = soup.select_one("span.a-color-price.a-text-bold, .a-spacing-base a.a-button-text")
        currently_unavailable = cu_el.get_text(strip=True) if cu_el else "In Stock"

        ship_date_el = soup.select_one("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE span.a-text-bold")
        shipping_date = ship_date_el.get_text(strip=True) if ship_date_el else "N/A"

        ship_by_el = soup.select_one("#fulfillerInfoFeature_feature_div span.offer-display-feature-text-message")
        ship_by = ship_by_el.get_text(strip=True) if ship_by_el else "N-A"

        sold_by_el = soup.select_one(".offer-display-feature-text-message a")
        sold_by = sold_by_el.get_text(strip=True) if sold_by_el else "N-A"

        import_el = soup.select_one("#globalStoreBadgePopoverInsideBuybox_feature_div div.a-section")
        import_info = import_el.get_text(strip=True) if import_el else "N-A"

        # Keep handling time extraction for business rules compatibility
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
            cls.set_zoom(driver, 0.6)
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
    async def scrape_with_zip_setup(cls, products_batch: List[Product], driver: webdriver.Chrome) -> List[Dict[str, Any]]:
        """Scrape products, setting ZIP code on the first available product page"""
        logger.info(f"Batch scrape start for {len(products_batch)} representatives (selenium)")
        t0 = timezone.now()
        results: List[Dict[str, Any]] = []
        
        zip_set = False
        zip_product_scraped = False
        
        # Try up to 5 products to find one with location selector
        for i, p in enumerate(products_batch):
            if not zip_set and i < 5:  # Try first 5 products max
                url = cls.build_amazon_au_url(p)
                if url:
                    logger.info(f"Attempting to set ZIP code on product {i+1}/5: {url}")
                    if cls.set_zip_code_on_product_page(driver, url):
                        zip_set = True
                        zip_product_scraped = True
                        logger.info("ZIP code set successfully, now scraping this product")
                        # Now scrape this product (we're already on the page)
                        data = cls.extract_data_from_current_page(driver, url)
                        error_output = data.get('error_status') or ''
                        success = not bool(error_output)
                        result = {
                            'product_id': p.id,
                            'vendor_sku': p.vendor_sku,
                            'url': url,
                            'success': success,
                            'error_status': error_output,
                        }
                        if success:
                            result.update(data)
                        results.append(result)
                        logger.info(f"ZIP setup product scraped: product_id={p.id} success={success}")
                        continue
                    else:
                        logger.warning(f"Product {i+1} doesn't have location selector, trying next product...")
                        # Continue trying other products for ZIP setup
            
            # If this product was already used for ZIP setup, skip regular scraping
            if zip_product_scraped and results and results[-1]['product_id'] == p.id:
                continue
                
            # Regular scraping for remaining products
            res = await cls.scrape_single(p, driver)
            results.append(res)
        
        if not zip_set:
            logger.warning("Could not set ZIP code on any of the first 5 products - continuing without location setting")
        
        ok = sum(1 for r in results if r.get('success'))
        logger.info(f"Batch scrape end: success={ok} failed={len(results)-ok} elapsed={(timezone.now()-t0).total_seconds():.2f}s")
        return results

    @classmethod
    def extract_data_from_current_page(cls, driver: webdriver.Chrome, url: str) -> Dict[str, Any]:
        """Extract data from current page without navigating"""
        try:
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
            logger.error(f"Selenium extract error for current page {url}: {e}")
            return { 'error_status': f"Exception: {e}" }

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