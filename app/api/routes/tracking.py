from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.job import JobRecord, JobStatus
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class JobTrackingUpdate(BaseModel):
    status: JobStatus
    firestore_id: Optional[str] = None

class JobTrackingResponse(BaseModel):
    id: int
    uid: str
    firestore_id: Optional[str]
    title: str
    company: str
    status: JobStatus
    captured_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

@router.get("/jobs", response_model=List[JobTrackingResponse])
def get_jobs(uid: str, db: Session = Depends(get_db)):
    jobs = db.query(JobRecord).filter(JobRecord.uid == uid).order_by(JobRecord.captured_at.desc()).all()
    return jobs

@router.patch("/jobs/{job_id}", response_model=JobTrackingResponse)
def update_job_status(job_id: int, update: JobTrackingUpdate, db: Session = Depends(get_db)):
    db_job = db.query(JobRecord).filter(JobRecord.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db_job.status = update.status
    if update.firestore_id:
        db_job.firestore_id = update.firestore_id
        
    db.commit()
    db.refresh(db_job)
    return db_job

@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    db_job = db.query(JobRecord).filter(JobRecord.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    db.delete(db_job)
    db.commit()
    return {"message": "Job deleted successfully"}
