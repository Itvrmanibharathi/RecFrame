"""
RecFrame — FastAPI application entry point.
"""
import json
import os
from datetime import timedelta
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db, init_db, Job
from auth import (
    authenticate_user, create_user, create_access_token,
    get_current_user, get_user_by_email,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from models import (
    RegisterRequest, LoginRequest, TokenResponse, UserOut,
    AnalysisResult, JobSummary,
)
from analyzer import analyze_video, MAX_VIDEO_BYTES

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="RecFrame API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten after Vercel deploy URL is known
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "RecFrame API v2"}


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    create_user(db, body.email, body.password)
    token = create_access_token({"sub": body.email})
    return {"access_token": token}


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user.email})
    return {"access_token": token}


@app.get("/auth/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user


# ── Analysis route ────────────────────────────────────────────────────────────

def _run_analysis(job_id: int, video_bytes: bytes, filename: str, db_session_factory):
    """Background task: run analysis and update DB."""
    db = db_session_factory()
    job = db.query(Job).filter(Job.id == job_id).first()
    try:
        result = analyze_video(video_bytes, top_n=10, filename=filename)
        job.status = "done"
        job.total_frames = result["total_frames"]
        job.fps = result["fps"]
        job.ideal_count = result["ideal_count"]
        job.good_count = result["good_count"]
        job.weak_count = result["weak_count"]
        # Store full result (key_frames thumbnails can be large — store compressed)
        job.result_json = json.dumps(result)
    except Exception as exc:
        job.status = "error"
        job.error_msg = str(exc)
    finally:
        db.commit()
        db.close()


@app.post("/api/analyze", status_code=202)
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # File type guard
    _ALLOWED_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=422,
            detail="Unsupported file type. Allowed: MP4, MOV, AVI, MKV, WEBM"
        )

    # Size guard
    video_bytes = await file.read()
    if len(video_bytes) > MAX_VIDEO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_VIDEO_BYTES // (1024*1024)} MB."
        )

    # Create pending job record
    job = Job(user_id=current_user.id, filename=file.filename, status="processing")
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = job.id

    # Run analysis in background
    from database import SessionLocal
    background_tasks.add_task(_run_analysis, job_id, video_bytes, file.filename, SessionLocal)

    return {"job_id": job_id, "status": "processing", "message": "Analysis started"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "id": job.id,
        "filename": job.filename,
        "status": job.status,
        "total_frames": job.total_frames,
        "fps": job.fps,
        "ideal_count": job.ideal_count,
        "good_count": job.good_count,
        "weak_count": job.weak_count,
        "error_msg": job.error_msg,
        "created_at": job.created_at.isoformat(),
    }

    if job.status == "done" and job.result_json:
        response["result"] = json.loads(job.result_json)

    return response


@app.get("/api/jobs", response_model=List[JobSummary])
def list_jobs(
    skip: int = 0,
    limit: int = 20,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(Job)
        .filter(Job.user_id == current_user.id)
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return jobs
