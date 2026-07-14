import asyncio
import logging
import json
import time
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup

from app.services.browser_manager import BrowserManager
from app.utils.url_security import check_url_security
from app.utils.text_cleaning import clean_text
from app.schemas.webpage_extraction import (
    WebpageExtractionRequest,
    WebpageExtractionResponse,
    NetworkRequestLog,
    WebpageExtractionError
)

logger = logging.getLogger(__name__)

class WebpageExtractor:
    @staticmethod
    async def extract(request: WebpageExtractionRequest) -> WebpageExtractionResponse:
        """
        Executes the full webpage extraction pipeline:
        - SSRF validation
        - Playwright browser context creation
        - Safe page navigation with redirect inspection
        - Gradual scrolling
        - Content stabilization wait
        - Visible text & rendered HTML DOM extraction
        - JSON-LD structured data parsing
        - Network traffic inspection & logging
        """
        requested_url = request.url
        logger.info(f"Starting webpage extraction for: {requested_url}")

        # 1. SSRF Protection: Initial URL Check
        if not check_url_security(requested_url):
            return WebpageExtractionResponse(
                success=False,
                requested_url=requested_url,
                error=WebpageExtractionError(
                    type="security",
                    message="Access to the requested URL is blocked by security policies."
                )
            )

        browser = None
        context = None
        page = None
        network_logs: List[NetworkRequestLog] = []
        start_time = time.time()

        try:
            # 2. Launch Browser / Acquire shared browser instance
            # Run in headless mode by default, unless request.debug is True and we're not inside a container
            browser = await BrowserManager.get_browser(headless=not request.debug)

            # Create isolated browser context with realistic viewport and user agent
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
                ignore_https_errors=True
            )

            page = await context.new_page()

            # Set default timeout (e.g. 30 seconds for operations)
            page.set_default_timeout(45000)

            # 3. Network Request Logs Setup
            async def handle_response(response):
                try:
                    req = response.request
                    res_type = req.resource_type
                    if res_type in ("xhr", "fetch", "document"):
                        url = response.url
                        method = req.method
                        status = response.status
                        headers = response.headers
                        content_type = headers.get("content-type", "")

                        log_entry = NetworkRequestLog(
                            url=url,
                            status=status,
                            method=method,
                            resource_type=res_type,
                            content_type=content_type
                        )

                        # Inspect small JSON payloads matching job/career keywords
                        if request.include_network_log and "application/json" in content_type.lower() and status == 200:
                            url_lower = url.lower()
                            if any(k in url_lower for k in ("api", "job", "jobs", "career", "position", "opening", "graphql")):
                                try:
                                    body_text = await response.text()
                                    if len(body_text) < 100000:  # < 100KB to stay lightweight
                                        log_entry.body_preview = body_text[:2000]
                                except Exception:
                                    pass

                        network_logs.append(log_entry)
                except Exception as e:
                    logger.debug(f"Error logging response: {e}")

            page.on("response", handle_response)

            # 4. SSRF Redirect Protection
            security_violation = False
            
            def handle_framenavigated(frame):
                nonlocal security_violation
                if frame == page.main_frame:
                    current_url = frame.url
                    if current_url != "about:blank" and not check_url_security(current_url):
                        logger.warning(f"SSRF Protection: Unsafe redirect detected to {current_url}")
                        security_violation = True
                        # Close page to abort navigation
                        asyncio.create_task(page.close())

            page.on("framenavigated", handle_framenavigated)

            # 5. Navigate to URL
            try:
                # Wait for domcontentloaded before starting interactive scrolling/waiting
                response = await page.goto(requested_url, wait_until="domcontentloaded")
                
                if security_violation:
                    raise ValueError("Blocked unsafe redirect")
                    
                status_code = response.status if response else 200
            except Exception as nav_err:
                if security_violation:
                    return WebpageExtractionResponse(
                        success=False,
                        requested_url=requested_url,
                        error=WebpageExtractionError(
                            type="security",
                            message="Navigation was aborted because the site attempted to redirect to an unsafe or private IP address."
                        )
                    )
                logger.error(f"Navigation error for {requested_url}: {nav_err}")
                return WebpageExtractionResponse(
                    success=False,
                    requested_url=requested_url,
                    error=WebpageExtractionError(
                        type="not_found",
                        message=f"Failed to load URL: {str(nav_err)}"
                    )
                )

            # 6. Wait for dynamic content to render / stabilize
            logger.info("Waiting for page content to stabilize...")
            min_text_len = 200
            stabilized = await wait_for_content_stabilization(page, min_text_len, timeout_ms=15000)
            if not stabilized:
                logger.warning("Content did not fully stabilize, proceeding with partial rendering.")

            # 7. Perform Controlled Scrolling
            await scroll_webpage(page, max_scrolls=15)

            # 8. Extra short wait for any lazy-loaded blocks triggered by scrolling
            await asyncio.sleep(1.0)

            # 9. Extract Visible Text
            # Order of preference: main, article, [role="main"], body
            visible_text = ""
            extracted_element = "body"
            for selector in ("main", "article", '[role="main"]'):
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text and len(text.strip()) > 150:
                        visible_text = text
                        extracted_element = selector
                        break
            
            if not visible_text:
                visible_text = await page.inner_text("body")

            cleaned_visible_text = clean_text(visible_text)

            # 10. Extract Rendered HTML DOM
            rendered_html = ""
            if request.include_html:
                rendered_html = await page.content()

            # 11. Extract Page Title & Final URL
            page_title = await page.title()
            final_url = page.url

            # 12. Parse JSON-LD structures
            structured_data = await extract_json_ld_from_page(page)

            # 13. Prepare Metadata
            duration = time.time() - start_time
            metadata = {
                "duration_seconds": round(duration, 3),
                "extracted_from_element": extracted_element,
                "text_length": len(cleaned_visible_text),
                "html_length": len(rendered_html) if request.include_html else 0
            }

            return WebpageExtractionResponse(
                success=True,
                requested_url=requested_url,
                final_url=final_url,
                status_code=status_code,
                page_title=page_title,
                visible_text=cleaned_visible_text,
                rendered_html=rendered_html if request.include_html else None,
                structured_data=structured_data,
                network_requests=network_logs if request.include_network_log else [],
                metadata=metadata
            )

        except Exception as e:
            logger.error(f"Error during extraction for {requested_url}: {e}", exc_info=True)
            return WebpageExtractionResponse(
                success=False,
                requested_url=requested_url,
                error=WebpageExtractionError(
                    type="server_error",
                    message=f"An unexpected server error occurred: {str(e)}"
                )
            )
        finally:
            # 14. Clean up Context & Page safely
            if page:
                try:
                    await page.close()
                except Exception:
                    pass
            if context:
                try:
                    await context.close()
                except Exception:
                    pass

async def wait_for_content_stabilization(page, min_len: int, timeout_ms: int) -> bool:
    """
    Waits until body text reaches a certain length and stops growing, or specific indicators
    appear on the page.
    """
    start_time = time.time()
    max_time = start_time + (timeout_ms / 1000.0)
    last_len = 0
    stable_checks = 0

    # Key terms often present in meaningful content (job postings)
    indicators = ("job description", "responsibilities", "requirements", "benefits", "about us", "apply")

    while time.time() < max_time:
        try:
            body_text = await page.inner_text("body")
            body_text = body_text.strip()
            current_len = len(body_text)

            # If major element already loaded and has text
            main_el = await page.query_selector("main, article")
            if main_el:
                main_text = await main_el.inner_text()
                if len(main_text.strip()) > min_len:
                    logger.debug("Found structural container (main/article) loaded.")
                    return True

            # If we see common keywords and have reasonable text
            if current_len > min_len:
                body_text_lower = body_text.lower()
                if any(ind in body_text_lower for ind in indicators):
                    logger.debug("Meaningful content terms detected in body.")
                    return True

                if current_len == last_len:
                    stable_checks += 1
                    if stable_checks >= 3:  # Stabilized over 3 intervals (approx 1.5 seconds)
                        logger.debug("Text length has stabilized.")
                        return True
                else:
                    stable_checks = 0
                
            last_len = current_len
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.debug(f"Error in stabilization check: {e}")
            await asyncio.sleep(0.5)

    return False

async def scroll_webpage(page, max_scrolls: int):
    """
    Gradually scrolls through the page, allowing lazy content to fetch and render.
    """
    try:
        last_height = await page.evaluate("document.body.scrollHeight")
        for scroll in range(max_scrolls):
            # Scroll down by viewport height
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await asyncio.sleep(0.4)

            new_height = await page.evaluate("document.body.scrollHeight")
            # If heights are equal, we might have hit the bottom
            if new_height == last_height and scroll > 5:
                break
            last_height = new_height

        # Scroll back to the top so normal extraction layout matches
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(0.2)
    except Exception as e:
        logger.debug(f"Scrolling error: {e}")

async def extract_json_ld_from_page(page) -> List[Any]:
    """
    Finds and parses all script[type="application/ld+json"] blocks.
    Keeps raw input and details on failures for malformed items.
    """
    structured_data = []
    try:
        scripts = await page.query_selector_all('script[type="application/ld+json"]')
        for script in scripts:
            text = await script.text_content()
            if not text:
                continue
            text = text.strip()
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    structured_data.extend(parsed)
                else:
                    structured_data.append(parsed)
            except Exception as err:
                structured_data.append({
                    "raw_text": text,
                    "parse_error": str(err)
                })
    except Exception as e:
        logger.debug(f"Structured data extraction error: {e}")
    return structured_data
