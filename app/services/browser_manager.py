import asyncio
import logging
from typing import Optional
from playwright.async_api import async_playwright, Browser, Playwright

logger = logging.getLogger(__name__)

class BrowserManager:
    _instance = None
    _playwright: Optional[Playwright] = None
    _browser: Optional[Browser] = None
    _lock = asyncio.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(BrowserManager, cls).__new__(cls)
        return cls._instance

    @classmethod
    async def get_browser(cls, headless: bool = True) -> Browser:
        """
        Retrieves the shared, application-level Browser instance.
        Launches Playwright and Chromium on demand.
        """
        async with cls._lock:
            if cls._playwright is None:
                logger.info("Initializing Playwright library...")
                cls._playwright = await async_playwright().start()
                
            if cls._browser is None:
                logger.info(f"Launching Chromium browser (headless={headless})...")
                cls._browser = await cls._playwright.chromium.launch(
                    headless=headless,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu"
                    ]
                )
            return cls._browser

    @classmethod
    async def close(cls):
        """
        Shuts down the browser and Playwright system cleanly.
        """
        async with cls._lock:
            if cls._browser:
                logger.info("Closing Browser instance...")
                try:
                    await cls._browser.close()
                except Exception as e:
                    logger.error(f"Error closing browser: {e}")
                cls._browser = None
                
            if cls._playwright:
                logger.info("Stopping Playwright library...")
                try:
                    await cls._playwright.stop()
                except Exception as e:
                    logger.error(f"Error stopping Playwright: {e}")
                cls._playwright = None
