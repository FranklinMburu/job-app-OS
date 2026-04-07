from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.job import JobRecord, JobStatus as DBJobStatus
from app.schemas.job import (
    ExtractJobRequest, ExtractedJob, ExtractionConfidence, 
    SourceType, Seniority, EmploymentType, RemotePolicy, ApplicationMethod,
    GenerateApplicationRequest, GeneratedApplication, OutputMode
)
from app.schemas.analysis import AnalyzeJobRequest, JobAnalysis, Verdict, ApplyRecommendation, Confidence
from app.services.ai_service import AIService
from app.services.web_fetcher import fetch_job_page
from app.services.ocr_service import extract_text_from_image
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
ai_service = AIService()

@router.post("/extract-job", response_model=ExtractedJob)
def extract_job(request: ExtractJobRequest, db_session: Session = Depends(get_db)):
    # Validate source_type rules
    content = ""
    try:
        if request.source_type == SourceType.text:
            if not request.raw_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Validation Error",
                        "detail": "raw_text is required when source_type is 'text'",
                        "code": "MISSING_RAW_TEXT",
                        "fields": ["raw_text"]
                    }
                )
            content = request.raw_text
        elif request.source_type == SourceType.link:
            if not request.url:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Validation Error",
                        "detail": "url is required when source_type is 'link'",
                        "code": "MISSING_URL",
                        "fields": ["url"]
                    }
                )
            
            # Validate URL protocol
            if not (request.url.startswith("http://") or request.url.startswith("https://")):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Validation Error",
                        "detail": "Invalid URL protocol. URL must start with http:// or https://",
                        "code": "INVALID_URL_PROTOCOL",
                        "fields": ["url"]
                    }
                )
            
            # Fetch content from URL
            logger.info(f"Fetching job content from URL: {request.url}")
            content = fetch_job_page(request.url)
            
            if not content or len(content.strip()) < 50:
                logger.warning(f"Fetched content from {request.url} is too short or empty: {len(content) if content else 0} chars")
                if not content or not content.startswith("Error fetching content"):
                    content = f"Error fetching content from {request.url}: Content too short or empty. The site might be blocking automated access."

            if content.startswith("Error fetching content"):
                 logger.error(f"Failed to fetch URL {request.url}: {content}")
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Fetch Error",
                        "detail": content,
                        "code": "URL_FETCH_FAILED",
                        "fields": ["url"]
                    }
                )
        elif request.source_type == SourceType.image:
            if not request.image_reference:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Validation Error",
                        "detail": "image_reference is required when source_type is 'image'",
                        "code": "MISSING_IMAGE_REFERENCE",
                        "fields": ["image_reference"]
                    }
                )
            # Extract text from image using OCR service
            logger.info("Extracting text from image via OCR service")
            content = extract_text_from_image(request.image_reference)
            if content.startswith("OCR failed"):
                logger.error(f"OCR failed for image: {content}")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error": "OCR Error",
                        "detail": content,
                        "code": "OCR_FAILED",
                        "fields": ["image_reference"]
                    }
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during job capture: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal Server Error", "detail": str(e)}
        )
    # Call AI Service
    try:
        job = ai_service.extract_job(content, request.source_type, user_id=request.user_id)
        
        # Save to Postgres
        try:
            db_job = JobRecord(
                uid=request.user_id,
                title=job.title,
                company=job.company,
                summary=job.summary,
                location=job.location,
                source_url=request.url if request.source_type == SourceType.link else None,
                source_type=request.source_type,
                status=DBJobStatus.captured,
                extra_data={
                    "seniority": job.seniority,
                    "employment_type": job.employment_type,
                    "remote_policy": job.remote_policy,
                    "requirements": job.requirements,
                    "required_skills": job.required_skills,
                    "preferred_skills": job.preferred_skills
                }
            )
            db_session.add(db_job)
            db_session.commit()
            db_session.refresh(db_job)
            logger.info(f"Saved job record to Postgres: {db_job.id}")
            job.postgres_id = db_job.id
        except Exception as db_err:
            logger.error(f"Failed to save job record to Postgres: {db_err}")
            # We don't fail the whole request if Postgres fails, as Firestore is primary
            
        return job
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "AI Error",
                "detail": str(e),
                "code": "AI_PARSE_ERROR",
                "fields": []
            }
        )

@router.post("/analyze-job", response_model=JobAnalysis)
def analyze_job(request: AnalyzeJobRequest):
    # Call AI Service
    try:
        return ai_service.analyze_job(request)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "AI Error",
                "detail": "Invalid AI response format",
                "code": "AI_PARSE_ERROR",
                "fields": []
            }
        )

@router.post("/generate-application", response_model=GeneratedApplication)
def generate_application(request: GenerateApplicationRequest):
    # Call AI Service
    try:
        return ai_service.generate_application(request, user_id=request.user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "AI Error",
                "detail": "Invalid AI response format",
                "code": "AI_PARSE_ERROR",
                "fields": []
            }
        )

@router.post("/generate-follow-up", response_model=GeneratedApplication)
def generate_follow_up(request: GenerateApplicationRequest):
    # Call AI Service
    try:
        return ai_service.generate_follow_up(request, user_id=request.user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "AI Error",
                "detail": "Invalid AI response format",
                "code": "AI_PARSE_ERROR",
                "fields": []
            }
        )
