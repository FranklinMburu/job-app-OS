from fastapi import APIRouter, HTTPException, status
from app.schemas.job import (
    ExtractJobRequest, ExtractedJob, ExtractionConfidence, 
    SourceType, Seniority, EmploymentType, RemotePolicy, ApplicationMethod,
    GenerateApplicationRequest, GeneratedApplication, OutputMode
)
from app.schemas.analysis import AnalyzeJobRequest, JobAnalysis, Verdict, ApplyRecommendation, Confidence
from app.services.ai_service import AIService
from app.services.web_fetcher import fetch_job_page
from typing import List

router = APIRouter()
ai_service = AIService()

@router.post("/extract-job", response_model=ExtractedJob)
def extract_job(request: ExtractJobRequest):
    # Validate source_type rules
    content = ""
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
        # Fetch content from URL
        content = fetch_job_page(request.url)
        if content.startswith("Error fetching content"):
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
        content = request.image_reference

    # Call AI Service
    try:
        return ai_service.extract_job(content, request.source_type, user_id=request.user_id)
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
