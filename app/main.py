import logging
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.api.routes import jobs, profile, tracking
from app.core.database import Base, engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Job Capture & Apply Assistant",
    description="Backend scaffold for job application automation",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up backend...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified.")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom error handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": str(exc),
            "code": "VALIDATION_ERROR",
            "fields": [err["loc"][-1] for err in exc.errors()]
        }
    )

# Custom error handler for HTTP exceptions to match spec format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP Error",
            "detail": str(exc.detail),
            "code": "HTTP_ERROR",
            "fields": []
        }
    )

# Health check
@app.get("/app-backend-v1/health")
async def health_check():
    return {"status": "ok", "service": "job-capture-backend"}

# Include routers
app.include_router(jobs.router, prefix="/app-backend-v1", tags=["Jobs"])
app.include_router(profile.router, prefix="/app-backend-v1/profile", tags=["Profile"])
app.include_router(tracking.router, prefix="/app-backend-v1/tracking", tags=["Tracking"])
