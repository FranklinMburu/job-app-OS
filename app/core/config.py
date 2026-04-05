import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Job Capture & Apply Assistant"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")

    class Config:
        env_file = ".env"

settings = Settings()
