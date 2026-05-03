"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, field_validator

from validators import validate_password


# ── Auth ──────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Frame data ────────────────────────────────────────────────────────────────
class FrameScore(BaseModel):
    frame: int
    texture: float
    edge: float
    motion: float
    exposure: float
    compression: float
    saturation: float
    scene_cut: float
    sss: float
    sss_smooth: float
    label: str
    label_smooth: str


class KeyFrame(BaseModel):
    frame_index: int
    sss_smooth: float
    label_smooth: str
    image_b64: str          # JPEG base64


class AnalysisResult(BaseModel):
    job_id: int
    filename: str
    total_frames: int
    fps: float
    ideal_count: int
    good_count: int
    weak_count: int
    frame_scores: List[FrameScore]
    key_frames: List[KeyFrame]
    csv_data: str           # full CSV text for download


# ── Job history ───────────────────────────────────────────────────────────────
class JobSummary(BaseModel):
    id: int
    filename: str
    status: str
    total_frames: Optional[int]
    fps: Optional[float]
    ideal_count: Optional[int]
    good_count: Optional[int]
    weak_count: Optional[int]
    error_msg: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class JobDetail(JobSummary):
    result_json: Optional[str]
