"""
Full pytest suite for the RecFrame API.
Covers: health, auth (register + login), analyze, jobs.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Test database setup ───────────────────────────────────────────────────────
TEST_DB_URL = "sqlite:///./test_recframe.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from database import Base, get_db, User, Job
from main import app, MAX_VIDEO_BYTES


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def registered(client):
    r = client.post("/auth/register", json={"email": "test@example.com", "password": "TestPass1!"})
    assert r.status_code == 201
    return r.json()


@pytest.fixture
def token(registered):
    return registered["access_token"]


@pytest.fixture
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Register ──────────────────────────────────────────────────────────────────

def test_register_valid(client):
    r = client.post("/auth/register", json={"email": "new@example.com", "password": "Valid1Pass!"})
    assert r.status_code == 201
    assert "access_token" in r.json()


def test_register_invalid_email(client):
    r = client.post("/auth/register", json={"email": "notanemail", "password": "Valid1Pass!"})
    assert r.status_code == 422


def test_register_password_too_short(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "Sh0rt!"})
    assert r.status_code == 422


def test_register_password_no_uppercase(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "lowercase1!"})
    assert r.status_code == 422


def test_register_password_no_lowercase(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "UPPERCASE1!"})
    assert r.status_code == 422


def test_register_password_no_digit(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "NoDigits!!"})
    assert r.status_code == 422


def test_register_password_no_special(client):
    r = client.post("/auth/register", json={"email": "a@b.com", "password": "NoSpecial1"})
    assert r.status_code == 422


def test_register_duplicate_email(client):
    client.post("/auth/register", json={"email": "dup@example.com", "password": "Valid1Pass!"})
    r = client.post("/auth/register", json={"email": "dup@example.com", "password": "Valid1Pass!"})
    assert r.status_code == 400


# ── Login ─────────────────────────────────────────────────────────────────────

def test_login_valid(client, registered):
    r = client.post("/auth/login", json={"email": "test@example.com", "password": "TestPass1!"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client, registered):
    r = client.post("/auth/login", json={"email": "test@example.com", "password": "WrongPass1!"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@example.com", "password": "Valid1Pass!"})
    assert r.status_code == 401


# ── Analyze ───────────────────────────────────────────────────────────────────

def test_analyze_unauthenticated(client):
    r = client.post("/api/analyze", files={"file": ("test.mp4", b"fake", "video/mp4")})
    assert r.status_code == 401


def test_analyze_file_too_large(client, auth, monkeypatch):
    import main as _main
    monkeypatch.setattr(_main, "MAX_VIDEO_BYTES", 10)
    r = client.post(
        "/api/analyze",
        files={"file": ("test.mp4", b"x" * 11, "video/mp4")},
        headers=auth,
    )
    assert r.status_code == 413


def test_analyze_wrong_file_type(client, auth):
    r = client.post(
        "/api/analyze",
        files={"file": ("notes.txt", b"not a video", "text/plain")},
        headers=auth,
    )
    assert r.status_code == 422


# ── Jobs ──────────────────────────────────────────────────────────────────────

def test_list_jobs_unauthenticated(client):
    r = client.get("/api/jobs")
    assert r.status_code == 401


def test_list_jobs_empty(client, auth):
    r = client.get("/api/jobs", headers=auth)
    assert r.status_code == 200
    assert r.json() == []


def test_get_job_not_found(client, auth):
    r = client.get("/api/jobs/9999", headers=auth)
    assert r.status_code == 404


def test_get_job_wrong_user(client, registered):
    # Register a second user
    client.post("/auth/register", json={"email": "other@example.com", "password": "OtherPass1!"})
    other_token = client.post(
        "/auth/login", json={"email": "other@example.com", "password": "OtherPass1!"}
    ).json()["access_token"]

    # Insert a job for the first user directly (bypasses the video analysis)
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "test@example.com").first()
    job = Job(user_id=user.id, filename="test.mp4", status="processing")
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = job.id
    db.close()

    # Second user must NOT see first user's job
    r = client.get(
        f"/api/jobs/{job_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert r.status_code == 404
