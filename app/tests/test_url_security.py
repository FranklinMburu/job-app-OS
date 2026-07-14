import unittest
from app.utils.url_security import check_url_security, is_safe_ip

class TestURLSecurity(unittest.TestCase):
    def test_safe_urls(self):
        # Public domains should be safe
        self.assertTrue(check_url_security("https://google.com"))
        self.assertTrue(check_url_security("https://buckhill.careers.hibob.com/jobs/b5e1bc52-f4a9-427e-bf4a-1e7f08a0438d"))
        self.assertTrue(check_url_security("http://example.com"))

    def test_unsafe_local_hosts_and_protocols(self):
        # Unsafe protocol schemes
        self.assertFalse(check_url_security("file:///etc/passwd"))
        self.assertFalse(check_url_security("ftp://example.com"))
        self.assertFalse(check_url_security("data:text/html,<html></html>"))
        self.assertFalse(check_url_security("javascript:alert(1)"))

        # Unsafe hostnames / loopbacks
        self.assertFalse(check_url_security("http://localhost"))
        self.assertFalse(check_url_security("https://127.0.0.1"))
        self.assertFalse(check_url_security("http://0.0.0.0"))
        
        # Link-local and cloud metadata addresses
        self.assertFalse(check_url_security("http://169.254.169.254"))
        self.assertFalse(check_url_security("http://169.254.10.10"))

    def test_safe_vs_unsafe_ips(self):
        self.assertFalse(is_safe_ip("127.0.0.1"))
        self.assertFalse(is_safe_ip("10.0.0.1"))
        self.assertFalse(is_safe_ip("192.168.1.1"))
        self.assertFalse(is_safe_ip("172.16.0.1"))
        self.assertFalse(is_safe_ip("169.254.169.254"))
        self.assertFalse(is_safe_ip("::1"))
        self.assertFalse(is_safe_ip("fc00::"))
        self.assertTrue(is_safe_ip("8.8.8.8"))
        self.assertTrue(is_safe_ip("142.250.190.46"))

if __name__ == "__main__":
    unittest.main()
