import socket
import ipaddress
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

def is_safe_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        # Check if it's private, loopback, link-local, unspecified, etc.
        if (ip.is_private or 
            ip.is_loopback or 
            ip.is_link_local or 
            ip.is_unspecified or 
            ip.is_reserved or 
            ip.is_multicast):
            return False
        # Double check Cloud Metadata endpoints
        if str(ip) == "169.254.169.254":
            return False
        return True
    except ValueError:
        return False

def check_url_security(url: str) -> bool:
    """
    Checks if a URL is safe from SSRF.
    Ensures correct protocol (http/https), validates localhost, and resolves DNS
    to make sure it doesn't map to a private, loopback, or link-local IP range.
    """
    if not url:
        return False
        
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            logger.warning(f"SSRF Protection: Rejected invalid protocol '{scheme}' for {url}")
            return False
        
        hostname = parsed.hostname
        if not hostname:
            logger.warning(f"SSRF Protection: Rejected URL without hostname: {url}")
            return False
        
        hostname_lower = hostname.lower()
        if hostname_lower in ("localhost", "127.0.0.1", "0.0.0.0"):
            logger.warning(f"SSRF Protection: Rejected blocked hostname {hostname_lower}")
            return False
            
        # Resolve DNS
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            ips = {info[4][0] for info in addr_info}
            for ip in ips:
                if not is_safe_ip(ip):
                    logger.warning(f"SSRF Protection: Hostname {hostname} resolved to unsafe IP {ip}")
                    return False
        except Exception as dns_err:
            logger.error(f"SSRF Protection: DNS resolution failed for {hostname}: {dns_err}")
            return False
            
        return True
    except Exception as e:
        logger.error(f"SSRF Protection: Exception during URL check for {url}: {e}")
        return False
