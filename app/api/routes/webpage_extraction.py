from fastapi import APIRouter, HTTPException, status
from app.schemas.webpage_extraction import WebpageExtractionRequest, WebpageExtractionResponse
from app.services.webpage_extractor import WebpageExtractor
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/extract-webpage", response_model=WebpageExtractionResponse)
async def extract_webpage(request: WebpageExtractionRequest):
    """
    Exposes the webpage extraction service:
    - Accepts requested URL and config parameters.
    - Runs Playwright in an isolated browser context.
    - Safely sanitizes the destination IP to prevent SSRF.
    - Wait for content stabilization & scrolls for dynamic assets.
    - Returns structured text, HTML DOM, metadata, and JSON-LD data.
    """
    try:
        response = await WebpageExtractor.extract(request)
        return response
    except Exception as e:
        logger.error(f"Failed to handle extract-webpage API call: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal Server Error",
                "detail": str(e)
            }
        )
