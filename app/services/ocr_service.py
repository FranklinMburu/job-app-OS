import pytesseract
from PIL import Image
import io
import base64
import logging
import os
import google.generativeai as genai
from app.core.ai_config import get_model

logger = logging.getLogger(__name__)

def extract_text_from_image(image_data: str) -> str:
    """
    Extract text from a base64 encoded image string.
    Uses Gemini Vision as the primary OCR engine for high accuracy,
    with Tesseract as a local fallback.
    """
    try:
        # Decode base64 image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        image_bytes = base64.b64decode(image_data)
        
        # Try Gemini Vision first (Google's state-of-the-art vision model)
        try:
            model = get_model()
            if model:
                # Prepare image for Gemini
                image_parts = [
                    {
                        "mime_type": "image/png", # Defaulting to png, base64 decode handles most
                        "data": image_bytes
                    }
                ]
                
                prompt = "Extract all the text from this image exactly as it appears. If it's a job posting, ensure all details are captured."
                
                response = model.generate_content([prompt, image_parts[0]])
                if response and response.text:
                    logger.info("OCR successful using Gemini Vision")
                    return response.text
        except Exception as gemini_err:
            logger.warning(f"Gemini OCR failed, falling back to Tesseract: {gemini_err}")

        # Fallback to Tesseract
        try:
            img = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(img)
            if text.strip():
                logger.info("OCR successful using Tesseract")
                return text
        except Exception as tesseract_err:
            logger.error(f"Tesseract OCR failed: {tesseract_err}")
            
        return "Failed to extract text from image using all available OCR methods."
        
    except Exception as e:
        logger.error(f"OCR process failed: {e}")
        return f"OCR failed: {str(e)}"
