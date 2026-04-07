from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, JSON
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class JobStatus(str, enum.Enum):
    saved = "saved"
    captured = "captured"
    analyzed = "analyzed"
    apply_now = "apply_now"
    applied = "applied"
    interview = "interview"
    rejected = "rejected"
    offer = "offer"
    archived = "archived"
    follow_up = "follow_up"

class JobRecord(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String, index=True)  # Firebase Auth UID
    firestore_id = Column(String, unique=True, index=True) # Reference to Firestore document ID
    
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    summary = Column(Text)
    location = Column(String)
    
    source_url = Column(String)
    source_type = Column(String)
    
    # Lifecycle Tracking
    status = Column(Enum(JobStatus), default=JobStatus.saved)
    
    # AI Analysis Cache
    analysis = Column(JSON)
    
    # Metadata
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Extra fields for flexibility
    extra_data = Column(JSON)
