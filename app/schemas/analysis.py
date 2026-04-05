from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List
from enum import Enum

class Verdict(str, Enum):
    relevant = "relevant"
    maybe = "maybe"
    not_worth_it = "not_worth_it"

class ApplyRecommendation(str, Enum):
    apply = "apply"
    apply_if_time = "apply_if_time"
    skip = "skip"

class Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class JobAnalysis(BaseModel):
    verdict: Verdict
    apply_recommendation: ApplyRecommendation
    reasons: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    confidence: Confidence
    fit_summary: str

class AnalyzeJobRequest(BaseModel):
    job: ExtractedJob
    user_profile: UserProfile
    user_id: str

# Forward references
from app.schemas.job import ExtractedJob
from app.schemas.profile import UserProfile
AnalyzeJobRequest.model_rebuild()
