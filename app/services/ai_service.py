import google.generativeai as genai
import json
import re
import logging
import time
import uuid
import os
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Any, Dict, Type, TypeVar, Optional
from pydantic import BaseModel, ValidationError
from fastapi import HTTPException, status
from PIL import Image
import io
import base64
from app.core.ai_config import get_model, MODEL_NAME
from app.schemas.job import ExtractedJob, GeneratedApplication, SourceType, ExtractionConfidence
from app.schemas.analysis import JobAnalysis, AnalyzeJobRequest, Verdict, ApplyRecommendation, Confidence
from app.schemas.job import GenerateApplicationRequest
from app.services.web_fetcher import fetch_job_page
from app.services.ocr_service import extract_text_from_image

# Set up logging
logger = logging.getLogger(__name__)

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        # In this environment, we can usually initialize without explicit credentials
        # as it uses the service account of the environment.
        firebase_admin.initialize_app()
    db = firestore.client()
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin: {e}")
    db = None

T = TypeVar("T", bound=BaseModel)

def extract_json(text: str) -> dict:
    """
    Find JSON inside response.
    Handles ```json blocks, raw JSON, and surrounding text.
    """
    try:
        # Clean up potential markdown artifacts
        text = text.strip()
        json_match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
            
        return json.loads(text)
    except Exception as e:
        logger.error(f"Failed to extract JSON from AI response. Error: {e}. Raw text: {text[:200]}...")
        raise ValueError(f"Invalid AI response format. Expected JSON, got: {text[:50]}...")

class AIService:
    def __init__(self):
        self.model = get_model()
        if not self.model:
            logger.error("CRITICAL: GEMINI_API_KEY is missing. AI Fit Match will fail.")

    def _safe_parse(self, data: Dict[str, Any], model_class: Type[T], request_id: str) -> T:
        """Normalize data and parse into Pydantic model with 422 error handling."""
        try:
            return model_class(**data)
        except ValidationError as e:
            logger.error(f"[{request_id}] Schema validation failed for {model_class.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "AI Schema Error",
                    "detail": f"AI returned invalid schema for {model_class.__name__}",
                    "request_id": request_id,
                    "code": "AI_PARSE_ERROR",
                    "fields": [str(err["loc"]) for err in e.errors()]
                }
            )

    def _log_interaction(self, action: str, prompt: str, response: str, latency: float, request_id: str, user_id: str = "anonymous", tokens_input: int = 0, tokens_output: int = 0):
        """
        Log AI interaction for auditing and troubleshooting.
        """
        log_data = {
            "request_id": request_id,
            "uid": user_id,
            "model": MODEL_NAME,
            "action": action,
            "latency_ms": int(latency * 1000),
            "tokens_input": int(tokens_input),
            "tokens_output": int(tokens_output),
            "prompt": prompt,
            "response": response,
            "timestamp": firestore.SERVER_TIMESTAMP if db else time.time()
        }
        # Log summary for quick troubleshooting
        logger.info(f"AI_FIT_MATCH_LOG [{request_id}] {action} completed in {log_data['latency_ms']}ms")
        
        # Detailed logs for investigation
        logger.info(f"[{request_id}] PROMPT: {prompt}")
        logger.info(f"[{request_id}] RESPONSE: {response}")

        # Store in Firestore
        if db:
            try:
                db.collection("ai_logs").document(request_id).set(log_data)
            except Exception as e:
                logger.error(f"Failed to store log in Firestore: {e}")

    def extract_job(self, content: str, source_type: SourceType, user_id: str = "anonymous") -> ExtractedJob:
        """Extract job details from raw content using AI."""
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Pre-processing based on source type
        processed_content = content
        image_data = None
        mime_type = "image/png"
        
        # Only fetch if content looks like a URL and we haven't fetched it yet
        if source_type == SourceType.link and len(content) < 2000 and (content.startswith('http://') or content.startswith('https://')):
            logger.info(f"[{request_id}] Fetching content from URL in AIService: {content[:50]}...")
            processed_content = fetch_job_page(content)
        elif source_type == SourceType.image:
            # If it's an image, we'll pass it directly to Gemini if it's base64
            if content.startswith('data:image'):
                # Extract the base64 part and mime type
                try:
                    header, image_data = content.split(',', 1)
                    mime_type = header.split(';')[0].split(':')[1]
                except (IndexError, ValueError):
                    image_data = content
            elif len(content) > 100 and ' ' not in content[:100]:
                # Heuristic: if it's long and has no spaces in the first 100 chars, it's likely base64
                image_data = content
            else:
                # Likely OCR text already extracted
                processed_content = content
                image_data = None

        # Prevent misuse: Limit content length for text
        if not image_data and len(processed_content) > 50000:
            logger.warning(f"[{request_id}] Content too long ({len(processed_content)} chars). Truncating.")
            processed_content = processed_content[:50000]

        prompt = f"""
Extraction
You are a strict data extraction engine.

Your task is to extract structured job information from raw job description text.

RULES:

* Return ONLY valid JSON
* No explanations
* No markdown
* No extra text
* Do NOT hallucinate missing fields
* If data is missing, return null or empty array

OUTPUT FORMAT:
{{
"title": "string | null",
"company": "string | null",
"location": "string | null",
"employment_type": "string | null",
"seniority": "string | null",
"summary": "string | null",
"requirements": ["string"],
"skills": ["string"]
}}

EXTRACTION GUIDELINES:

* "title" = job title
* "company" = hiring company
* "requirements" = responsibilities + requirements (merged clean list)
* "skills" = explicit tools, technologies, competencies
* Keep items SHORT and CLEAN
* Remove duplicates
* Do NOT invent skills

INPUT:
{processed_content if not image_data else "[IMAGE PROVIDED]"}
"""
        
        fallback = ExtractedJob(
            title="Unknown Job",
            source_type=source_type,
            extraction_confidence=ExtractionConfidence.low,
            summary="Failed to extract job details automatically. Please check your connection or the source content."
        )
        
        if not self.model:
            return fallback

        try:
            if image_data:
                # Multimodal request using PIL Image
                try:
                    image_bytes = base64.b64decode(image_data)
                    img = Image.open(io.BytesIO(image_bytes))
                    response = self.model.generate_content([prompt, img])
                except Exception as img_err:
                    logger.error(f"[{request_id}] Failed to process image with PIL: {img_err}")
                    # Fallback to dict format if PIL fails
                    image_part = {
                        "mime_type": mime_type,
                        "data": image_data
                    }
                    response = self.model.generate_content([prompt, image_part])
            else:
                response = self.model.generate_content(prompt)
                
            latency = time.time() - start_time
            
            usage = response.usage_metadata
            self._log_interaction(
                "extract_job", 
                prompt, 
                response.text, 
                latency, 
                request_id, 
                user_id=user_id,
                tokens_input=usage.prompt_token_count,
                tokens_output=usage.candidates_token_count
            )
            
            data = extract_json(response.text)
            data["source_type"] = source_type
            
            # Ensure required fields for Pydantic
            if "extraction_confidence" not in data:
                data["extraction_confidence"] = "medium"
                
            return self._safe_parse(data, ExtractedJob, request_id)
        except Exception as e:
            logger.error(f"[{request_id}] extract_job failure: {e}")
            # If multimodal fails, try fallback to OCR text if available
            if image_data:
                try:
                    logger.info(f"[{request_id}] Multimodal failed, falling back to OCR text.")
                    ocr_text = extract_text_from_image(content)
                    return self.extract_job(ocr_text, SourceType.text, user_id)
                except Exception as ocr_err:
                    logger.error(f"[{request_id}] OCR fallback also failed: {ocr_err}")
            return fallback

    def analyze_job(self, request: AnalyzeJobRequest) -> JobAnalysis:
        """Analyze fit between job and user profile using AI."""
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Prevent misuse: Basic validation
        if not request.job.title and not request.job.summary:
             raise HTTPException(status_code=400, detail="Job data is too sparse for analysis.")

        prompt = f"""
        TASK: Compare the job description and the user profile to determine fit.
        REQUEST_ID: {request_id}
        
        JOB DATA:
        {request.job.model_dump_json(indent=2)}
        
        USER PROFILE:
        {request.user_profile.model_dump_json(indent=2)}
        
        INSTRUCTIONS:
        1. Analyze the alignment between the job requirements and the user's skills/experience.
        2. Determine a 'verdict' (relevant, maybe, not_worth_it).
        3. Provide a 'apply_recommendation' (apply, apply_if_time, skip).
        4. List specific 'reasons' for the recommendation (strengths).
        5. List specific 'gaps' where the user might be lacking.
        6. Provide a concise 'fit_summary' explaining the overall match.
        7. Set a 'confidence' level for your analysis.
        
        OUTPUT FORMAT: JSON matching the JobAnalysis schema.
        """
        
        fallback = JobAnalysis(
            verdict=Verdict.maybe,
            apply_recommendation=ApplyRecommendation.apply_if_time,
            confidence=Confidence.low,
            fit_summary="AI Fit Match was unable to process this request. This might be due to insufficient profile data or a temporary service interruption.",
            reasons=["Troubleshooting: Check if your CV text is complete.", "Troubleshooting: Ensure the job description was extracted correctly."],
            gaps=["Unknown"]
        )
        
        if not self.model:
            logger.error(f"[{request_id}] Model not initialized for analyze_job")
            return fallback

        try:
            logger.info(f"[{request_id}] Starting AI call for analyze_job...")
            response = self.model.generate_content(prompt)
            latency = time.time() - start_time
            logger.info(f"[{request_id}] AI call for analyze_job finished in {int(latency*1000)}ms")
            
            usage = response.usage_metadata
            self._log_interaction(
                "analyze_job", 
                prompt, 
                response.text, 
                latency, 
                request_id, 
                user_id=request.user_id,
                tokens_input=usage.prompt_token_count,
                tokens_output=usage.candidates_token_count
            )
            
            data = extract_json(response.text)
            return self._safe_parse(data, JobAnalysis, request_id)
        except Exception as e:
            logger.error(f"[{request_id}] analyze_job CRITICAL FAILURE: {str(e)}", exc_info=True)
            return fallback

    def generate_application(self, request: GenerateApplicationRequest, user_id: str = "anonymous") -> GeneratedApplication:
        """Generate a tailored application using AI."""
        request_id = str(uuid.uuid4())
        start_time = time.time()
        prompt = f"""
        TASK: Generate a tailored job application ({request.output_mode}).
        REQUEST_ID: {request_id}
        
        JOB: {request.job.model_dump_json(indent=2)}
        ANALYSIS: {request.analysis.model_dump_json(indent=2)}
        PROFILE: {request.user_profile.model_dump_json(indent=2)}
        
        OUTPUT FORMAT: JSON matching the GeneratedApplication schema.
        
        STRICT RULES:
        1. GROUNDING: Do not make fake claims.
        2. TONE: Use a {request.tone} tone.
        3. MODE: The output_mode is {request.output_mode}.
        4. CONCISENESS: Keep it professional.
        5. SUBJECT: Generate a concise, professional email subject line relevant to the job title.
        """
        
        fallback = GeneratedApplication(
            output_mode=request.output_mode,
            subject=f"Application for {request.job.title or 'Position'}",
            email_body="Dear Hiring Manager, I am interested in this position. (AI generation failed)",
            generation_confidence=ExtractionConfidence.low
        )
        
        if not self.model:
            return fallback

        try:
            response = self.model.generate_content(prompt)
            latency = time.time() - start_time
            
            usage = response.usage_metadata
            self._log_interaction(
                "generate_application", 
                prompt, 
                response.text, 
                latency, 
                request_id, 
                user_id=user_id,
                tokens_input=usage.prompt_token_count,
                tokens_output=usage.candidates_token_count
            )
            
            data = extract_json(response.text)
            data["output_mode"] = request.output_mode
            return self._safe_parse(data, GeneratedApplication, request_id)
        except Exception as e:
            logger.error(f"generate_application failure: {e}")
            return fallback

    def generate_follow_up(self, request: GenerateApplicationRequest, user_id: str = "anonymous") -> GeneratedApplication:
        """Generate a professional follow-up email using AI."""
        request_id = str(uuid.uuid4())
        start_time = time.time()
        prompt = f"""
        TASK: Generate a professional, polite, and concise follow-up email for a job application.
        REQUEST_ID: {request_id}
        
        JOB: {request.job.model_dump_json(indent=2)}
        ORIGINAL APPLICATION: {request.analysis.model_dump_json(indent=2)}
        PROFILE: {request.user_profile.model_dump_json(indent=2)}
        
        OUTPUT FORMAT: JSON matching the GeneratedApplication schema.
        
        STRICT RULES:
        1. TONE: Professional and polite.
        2. CONCISENESS: Keep it short (2-3 paragraphs max).
        3. SUBJECT: Generate a follow-up subject line (e.g., "Follow-up: [Original Subject]").
        """
        
        fallback = GeneratedApplication(
            output_mode=request.output_mode,
            subject=f"Follow-up: Application for {request.job.title or 'Position'}",
            email_body="Dear Hiring Manager, I am following up on my application. (AI generation failed)",
            generation_confidence=ExtractionConfidence.low
        )
        
        if not self.model:
            return fallback

        try:
            response = self.model.generate_content(prompt)
            latency = time.time() - start_time
            
            usage = response.usage_metadata
            self._log_interaction(
                "generate_follow_up", 
                prompt, 
                response.text, 
                latency, 
                request_id, 
                user_id=user_id,
                tokens_input=usage.prompt_token_count,
                tokens_output=usage.candidates_token_count
            )
            
            data = extract_json(response.text)
            data["output_mode"] = request.output_mode
            return self._safe_parse(data, GeneratedApplication, request_id)
        except Exception as e:
            logger.error(f"generate_follow_up failure: {e}")
            return fallback

    def synthesize_profile(self, cv_text: str, user_id: str = "anonymous") -> Dict[str, Any]:
        """Synthesize a structured profile from raw CV text using AI."""
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        prompt = f"""
        TASK: Extract structured professional profile data from the provided CV text.
        REQUEST_ID: {request_id}
        CV TEXT:
        ---
        {cv_text}
        ---
        
        INSTRUCTIONS:
        1. Extract the user's full name, email, phone, and location.
        2. Identify their target roles based on their experience.
        3. Extract a comprehensive list of technical and soft skills.
        4. Estimate their total years of professional experience.
        5. Write a concise 2-3 sentence experience summary.
        6. Identify preferred industries based on their work history.
        
        OUTPUT FORMAT: JSON matching a partial UserProfile schema.
        Include: full_name, email, phone, location, target_roles, skills, years_of_experience, experience_summary, preferred_industries.
        """
        
        if not self.model:
            return {}

        try:
            response = self.model.generate_content(prompt)
            latency = time.time() - start_time
            
            usage = response.usage_metadata
            self._log_interaction(
                "synthesize_profile", 
                prompt, 
                response.text, 
                latency, 
                request_id, 
                user_id=user_id,
                tokens_input=usage.prompt_token_count,
                tokens_output=usage.candidates_token_count
            )
            
            return extract_json(response.text)
        except Exception as e:
            logger.error(f"[{request_id}] synthesize_profile failure: {e}")
            return {}
