from fastapi import APIRouter, HTTPException, status
from app.schemas.profile import UserProfile
from typing import List

from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()

@router.post("/validate")
def validate_profile(profile: UserProfile):
    is_valid = True
    missing_info = []
    suggestions = []

    if len(profile.cv_text) < 50:
        is_valid = False
        missing_info.append("cv_text")
        suggestions.append("Add more CV text to improve analysis quality.")

    if not profile.skills:
        suggestions.append("Consider adding core skills to your profile for better matching.")

    return {
        "is_valid": is_valid,
        "missing_info": missing_info,
        "suggestions": suggestions
    }

from pydantic import BaseModel

class SynthesizeRequest(BaseModel):
    cv_text: str
    user_id: str = "anonymous"

@router.post("/synthesize")
def synthesize_profile(request: SynthesizeRequest):
    try:
        return ai_service.synthesize_profile(request.cv_text, user_id=request.user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
