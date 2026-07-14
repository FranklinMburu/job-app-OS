import sys
import json
import asyncio
import logging

# Disable general logging to stdout so it doesn't pollute the JSON output
logging.basicConfig(level=logging.ERROR)

from app.schemas.webpage_extraction import WebpageExtractionRequest
from app.services.webpage_extractor import WebpageExtractor
from app.services.browser_manager import BrowserManager

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False, 
            "requested_url": "", 
            "error": {"type": "server_error", "message": "Missing JSON input argument"}
        }))
        return
        
    try:
        args_str = sys.argv[1]
        args_dict = json.loads(args_str)
        request = WebpageExtractionRequest(**args_dict)
        
        response = await WebpageExtractor.extract(request)
        # Output the model as dict/json
        print(response.model_dump_json())
    except Exception as e:
        print(json.dumps({
            "success": False, 
            "requested_url": "", 
            "error": {"type": "server_error", "message": str(e)}
        }))
    finally:
        # Safely shut down playwright to free resources
        await BrowserManager.close()

if __name__ == "__main__":
    asyncio.run(main())
