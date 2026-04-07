import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

def fetch_job_page(url: str) -> str:
    """
    Fetch job page HTML and extract clean text.
    Removes common noise like headers, footers, and scripts to focus on job content.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
        }
        
        # Add a session to handle cookies if needed
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=20, allow_redirects=True)
        response.raise_for_status()
        
        # Ensure correct encoding
        if response.encoding is None or response.encoding == 'ISO-8859-1':
            response.encoding = response.apparent_encoding
            
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove non-content elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "form", "svg", "noscript", "iframe"]):
            element.extract()
            
        # Try to find common job description containers if possible
        # This is a heuristic, we still fallback to full body if not found
        content_selectors = [
            'main', 'article', 
            '.job-description', '#job-description', 
            '.posting-content', '.job-details',
            '[data-automation-id="jobPostingDescription"]',
            '.jobs-description-content__text'
        ]
        
        main_content = None
        for selector in content_selectors:
            found = soup.select_one(selector)
            if found and len(found.get_text()) > 200:
                main_content = found
                break
        
        if not main_content:
            # Try finding by class name containing keywords
            content_areas = soup.find_all(['div', 'section'], class_=lambda x: x and any(term in x.lower() for term in ['job', 'description', 'posting', 'career', 'content']))
            if content_areas:
                main_content = max(content_areas, key=lambda x: len(x.get_text()))
        
        if main_content:
            text = main_content.get_text(separator="\n")
        else:
            # Fallback to body
            text = soup.body.get_text(separator="\n") if soup.body else soup.get_text(separator="\n")
        
        # Clean up the text
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines and very short lines that are likely noise
        text = "\n".join(chunk for chunk in chunks if chunk and len(chunk) > 2)
        
        # Limit text size to avoid overwhelming the AI
        return text[:50000]
    except Exception as e:
        logger.error(f"Failed to fetch job page at {url}: {e}")
        return f"Error fetching content from {url}: {str(e)}"
