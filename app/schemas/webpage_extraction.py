from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class WebpageExtractionRequest(BaseModel):
    url: str
    include_html: bool = True
    include_network_log: bool = True
    debug: bool = False

class NetworkRequestLog(BaseModel):
    url: str
    status: Optional[int] = None
    method: str
    resource_type: str
    content_type: Optional[str] = None
    body_preview: Optional[str] = None

class WebpageExtractionError(BaseModel):
    type: str
    message: str

class WebpageExtractionResponse(BaseModel):
    success: bool
    requested_url: str
    final_url: Optional[str] = None
    status_code: Optional[int] = None
    page_title: Optional[str] = None
    visible_text: Optional[str] = None
    rendered_html: Optional[str] = None
    structured_data: List[Any] = Field(default_factory=list)
    network_requests: List[NetworkRequestLog] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[WebpageExtractionError] = None
