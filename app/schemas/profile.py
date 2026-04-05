from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from enum import Enum

class TonePreference(str, Enum):
    professional = "professional"
    confident = "confident"
    concise = "concise"

class UserProfile(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    location: Optional[str] = None
    target_roles: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    years_of_experience: str
    experience_summary: str
    preferred_industries: List[str] = Field(default_factory=list)
    cv_text: str
    tone_preference: TonePreference
