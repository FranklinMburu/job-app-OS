import unittest
import asyncio
from app.schemas.webpage_extraction import WebpageExtractionRequest
from app.services.webpage_extractor import WebpageExtractor

class TestWebpageExtractor(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.get_event_loop()

    def test_unsafe_url_rejection(self):
        async def run_test():
            req = WebpageExtractionRequest(url="http://localhost:8080")
            res = await WebpageExtractor.extract(req)
            self.assertFalse(res.success)
            self.assertEqual(res.error.type, "security")
            self.assertIn("security policies", res.error.message)
            
        self.loop.run_until_complete(run_test())

    def test_invalid_scheme_rejection(self):
        async def run_test():
            req = WebpageExtractionRequest(url="ftp://google.com")
            res = await WebpageExtractor.extract(req)
            self.assertFalse(res.success)
            self.assertEqual(res.error.type, "security")

        self.loop.run_until_complete(run_test())

    def test_not_found_handling(self):
        async def run_test():
            # A domain that does not resolve/exist
            req = WebpageExtractionRequest(url="https://thisdomainwillnotresolve12345.com")
            res = await WebpageExtractor.extract(req)
            self.assertFalse(res.success)
            self.assertEqual(res.error.type, "security")

        self.loop.run_until_complete(run_test())

if __name__ == "__main__":
    unittest.main()
