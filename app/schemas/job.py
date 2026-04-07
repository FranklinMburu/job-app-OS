from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class SourceType(str, Enum):
    text = "text"
    link = "link"
    image = "image"

class Seniority(str, Enum):
    intern = "intern"
    junior = "junior"
    mid = "mid"
    senior = "senior"
    lead = "lead"
    unknown = "unknown"

class EmploymentType(str, Enum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"
    temporary = "temporary"
    unknown = "unknown"

class RemotePolicy(str, Enum):
    remote = "remote"
    hybrid = "hybrid"
    onsite = "onsite"
    unknown = "unknown"

class ApplicationMethod(str, Enum):
    email = "email"
    external_link = "external_link"
    portal = "portal"
    unknown = "unknown"

class ExtractionConfidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class OutputMode(str, Enum):
    email = "email"
    form_answers = "form_answers"

class Tone(str, Enum):
    professional = "professional"
    confident = "confident"
    concise = "concise"

class ExtractJobRequest(BaseModel):
    source_type: SourceType
    raw_text: Optional[str] = None
    url: Optional[str] = None
    image_reference: Optional[str] = None
    source_label: Optional[str] = None
    capture_context: Optional[str] = None
    user_id: str

class ExtractedJob(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    summary: Optional[str] = None
    requirements: List[str] = Field(default_factory=list)
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    experience_years_required: Optional[str] = None
    seniority: Seniority = Seniority.unknown
    employment_type: EmploymentType = EmploymentType.unknown
    location: Optional[str] = None
    remote_policy: RemotePolicy = RemotePolicy.unknown
    application_method: ApplicationMethod = ApplicationMethod.unknown
    application_email: Optional[str] = None
    application_url: Optional[str] = None
    deadline: Optional[str] = Field(None, description="Application deadline. Prefer ISO 8601 (YYYY-MM-DD) if clear, otherwise raw string.")
    salary_info: Optional[str] = None
    source_type: SourceType
    source_label: Optional[str] = None
    raw_excerpt: Optional[str] = None
    missing_fields: List[str] = Field(default_factory=list)
    extraction_confidence: ExtractionConfidence
    postgres_id: Optional[int] = None

class GenerateApplicationRequest(BaseModel):
    job: ExtractedJob
    analysis: JobAnalysis
    user_profile: UserProfile
    output_mode: OutputMode
    tone: Tone
    user_id: str

class GeneratedApplication(BaseModel):
    output_mode: OutputMode
    subject: Optional[str] = None
    email_body: Optional[str] = None
    short_fit_answer: Optional[str] = None
    cover_note: Optional[str] = None
    attachment_note: Optional[str] = None
    generation_confidence: ExtractionConfidence

# Forward references
from app.schemas.analysis import JobAnalysis
from app.schemas.profile import UserProfile
GenerateApplicationRequest.model_rebuild()
