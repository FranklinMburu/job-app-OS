import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Default model name
MODEL_NAME = "gemini-3-flash-preview"

def get_model():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config={
            "response_mime_type": "application/json"
        }
    )
