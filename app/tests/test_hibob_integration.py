import unittest
import asyncio
from app.schemas.webpage_extraction import WebpageExtractionRequest
from app.services.webpage_extractor import WebpageExtractor

class TestHiBobIntegration(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.get_event_loop()

    def test_hibob_job_extraction(self):
        async def run_test():
            target_url = "https://buckhill.careers.hibob.com/jobs/b5e1bc52-f4a9-427e-bf4a-1e7f08a0438d"
            req = WebpageExtractionRequest(
                url=target_url,
                include_html=True,
                include_network_log=True
            )
            res = await WebpageExtractor.extract(req)
            
            # Assert successful pipeline run
            self.assertTrue(res.success)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.requested_url, target_url)
            self.assertIn("https://buckhill.careers.hibob.com", res.final_url)
            
            # Title checks
            self.assertIsNotNone(res.page_title)
            self.assertTrue(any(term in res.page_title for term in ("DevOps", "Buckhill", "Careers")), f"Unexpected title: {res.page_title}")
            
            # Text body content check (must verify key elements have been successfully rendered in SPA)
            self.assertIsNotNone(res.visible_text)
            self.assertIn("GitLab", res.visible_text)
            self.assertIn("DevOps", res.visible_text)
            self.assertIn("Remote work", res.visible_text)
            
            # HTML content check
            self.assertIsNotNone(res.rendered_html)
            self.assertTrue(len(res.rendered_html) > 1000)
            
            # Network logging checks
            self.assertTrue(len(res.network_requests) > 0)
            
            # Check for API responses loaded
            has_api_logs = any("api" in req.url for req in res.network_requests)
            self.assertTrue(has_api_logs, "Expected network logs to contain api-level requests")
            
            # Metadata checks
            self.assertIn("duration_seconds", res.metadata)
            self.assertTrue(res.metadata["duration_seconds"] > 0)

        self.loop.run_until_complete(run_test())

if __name__ == "__main__":
    unittest.main()
