"""
RecFrame v2 — Core Frame Analysis Engine
Ported from the PoC notebook (Frame_Detection_Improved.ipynb)
"""
import base64
import io
import math
import tempfile
import os
from typing import List, Dict, Any, Tuple

import cv2
import numpy as np
import pandas as pd
from PIL import Image
from skimage.feature import graycomatrix, graycoprops

# ── Feature weights (v2 calibration) ─────────────────────────────────────────
WEIGHTS = {
    "Texture":     0.22,
    "Edge":        0.22,
    "Motion":      0.18,
    "Exposure":    0.14,
    "Compression": 0.12,
    "Saturation":  0.12,
}

MAX_VIDEO_BYTES = 50 * 1024 * 1024   # 50 MB guard
TOP_N_DEFAULT = 10


# ── Individual feature functions ──────────────────────────────────────────────

def texture_complexity(gray: np.ndarray) -> float:
    """GLCM contrast × (1 − energy). Uses 64×64 crop for speed."""
    small = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
    glcm = graycomatrix(small, distances=[1], angles=[0, np.pi / 4],
                        levels=256, symmetric=True, normed=True)
    contrast = graycoprops(glcm, "contrast").mean()
    energy = graycoprops(glcm, "energy").mean()
    score = min(contrast / 500.0, 1.0) * (1.0 - energy)
    return round(float(np.clip(score, 0, 1)), 4)


def edge_density(gray: np.ndarray) -> float:
    """Fraction of pixels that are edges. Scaled so ~10 % edges → 1.0"""
    edges = cv2.Canny(gray, 80, 180)
    ratio = np.sum(edges > 0) / edges.size
    return round(float(np.clip(ratio * 8.0, 0, 1)), 4)


def motion_stability(prev_gray: np.ndarray | None, curr_gray: np.ndarray) -> float:
    """Optical-flow magnitude → stability score. First frame = 1.0."""
    if prev_gray is None:
        return 1.0
    flow = cv2.calcOpticalFlowFarneback(
        prev_gray, curr_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
    )
    magnitude, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    mean_mag = np.mean(magnitude)
    score = max(0.0, 1.0 - (mean_mag / 15.0))
    return round(float(score), 4)


def exposure_quality(gray: np.ndarray) -> float:
    """Rewards well-exposed frames (not too dark / not blown out)."""
    mean_b = np.mean(gray) / 255.0
    std_b = np.std(gray) / 128.0
    good_exposure = 1.0 - max(0.0, abs(mean_b - 0.50) - 0.20) * 3.0
    score = 0.5 * np.clip(good_exposure, 0, 1) + 0.5 * np.clip(std_b, 0, 1)
    return round(float(np.clip(score, 0, 1)), 4)


def compression_robustness(gray: np.ndarray) -> float:
    """DCT mid/high-frequency energy → compression-robustness score."""
    g256 = cv2.resize(gray, (256, 256), interpolation=cv2.INTER_AREA)
    dct = cv2.dct(np.float32(g256))
    hf = dct[8:, 8:]
    score = min(np.std(hf) / 40.0, 1.0)
    return round(float(score), 4)


def color_saturation(frame_bgr: np.ndarray) -> float:
    """Average HSV saturation → colourfulness score."""
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1].astype(np.float32) / 255.0
    score = np.mean(sat) * 1.8
    return round(float(np.clip(score, 0, 1)), 4)


def scene_cut_flag(prev_gray: np.ndarray | None, curr_gray: np.ndarray,
                   threshold: float = 0.35) -> float:
    """Bhattacharyya distance between consecutive histograms → cut detection."""
    if prev_gray is None:
        return 1.0
    hist_prev = cv2.calcHist([prev_gray], [0], None, [64], [0, 256])
    hist_curr = cv2.calcHist([curr_gray], [0], None, [64], [0, 256])
    cv2.normalize(hist_prev, hist_prev)
    cv2.normalize(hist_curr, hist_curr)
    diff = cv2.compareHist(hist_prev, hist_curr, cv2.HISTCMP_BHATTACHARYYA)
    return round(float(1.0 if diff < threshold else 0.0), 4)


# ── Feature extraction wrapper ────────────────────────────────────────────────

def extract_features(frame_bgr: np.ndarray, prev_gray: np.ndarray | None) -> Tuple[Dict, np.ndarray]:
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (256, 256), interpolation=cv2.INTER_AREA)
    frame_resized = cv2.resize(frame_bgr, (256, 256), interpolation=cv2.INTER_AREA)
    features = {
        "Texture":     texture_complexity(gray),
        "Edge":        edge_density(gray),
        "Motion":      motion_stability(prev_gray, gray),
        "Exposure":    exposure_quality(gray),
        "Compression": compression_robustness(gray),
        "Saturation":  color_saturation(frame_resized),
        "SceneCut":    scene_cut_flag(prev_gray, gray),
    }
    return features, gray


# ── SSS scoring ───────────────────────────────────────────────────────────────

def compute_sss(features: Dict) -> float:
    base = sum(WEIGHTS[k] * features[k] for k in WEIGHTS)
    gate = 1.0 if features["SceneCut"] == 1.0 else 0.4
    return round(float(base * gate), 4)


def classify_frame(sss: float) -> str:
    if sss >= 0.50:
        return "IDEAL"
    elif sss >= 0.28:
        return "GOOD"
    return "WEAK"


# ── Top-N diverse frame selector ──────────────────────────────────────────────

def select_top_n_diverse(df: pd.DataFrame, n: int = TOP_N_DEFAULT) -> List[int]:
    """Pick top-N frames by SSS_smooth, spaced across the video."""
    sorted_df = df.sort_values("SSS_smooth", ascending=False)
    selected_indices: List[int] = []
    if len(df) == 0:
        return selected_indices
    # Minimum spacing = total_frames / (n * 2) to ensure diversity
    min_gap = max(1, len(df) // (n * 2))
    for row_idx in sorted_df.index:
        frame_no = int(df.loc[row_idx, "Frame"])
        if all(abs(frame_no - s) >= min_gap for s in selected_indices):
            selected_indices.append(frame_no)
        if len(selected_indices) >= n:
            break
    return sorted(selected_indices)


# ── Frame thumbnail helper ────────────────────────────────────────────────────

def frame_to_base64_jpeg(frame_bgr: np.ndarray, max_dim: int = 480) -> str:
    """Resize frame, encode as JPEG, return base64 string."""
    h, w = frame_bgr.shape[:2]
    scale = min(max_dim / w, max_dim / h, 1.0)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Main orchestrator ─────────────────────────────────────────────────────────

def analyze_video(video_bytes: bytes, top_n: int = TOP_N_DEFAULT, filename: str = "video") -> Dict[str, Any]:
    """
    Full pipeline:
    1. Write bytes to temp file
    2. Extract features frame by frame
    3. Compute SSS + classification
    4. Temporal smoothing
    5. Select top-N key frames (with thumbnails)
    6. Build result dict
    """
    # Write to temp file (cv2 needs a real path)
    suffix = os.path.splitext(filename)[-1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError("Cannot open video file — unsupported format or corrupted file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0

        results = []
        prev_gray = None
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            features, gray = extract_features(frame, prev_gray)
            sss = compute_sss(features)
            label = classify_frame(sss)
            results.append({
                "Frame":       frame_idx,
                "Texture":     features["Texture"],
                "Edge":        features["Edge"],
                "Motion":      features["Motion"],
                "Exposure":    features["Exposure"],
                "Compression": features["Compression"],
                "Saturation":  features["Saturation"],
                "SceneCut":    features["SceneCut"],
                "SSS":         sss,
                "Label":       label,
            })
            prev_gray = gray
            frame_idx += 1

        cap.release()

        df = pd.DataFrame(results)

        # Temporal smoothing
        df["SSS_smooth"] = df["SSS"].rolling(window=3, center=True, min_periods=1).mean().round(4)
        df["Label_smooth"] = df["SSS_smooth"].apply(classify_frame)

        # Label counts (smoothed)
        label_counts = df["Label_smooth"].value_counts().to_dict()
        ideal_count = int(label_counts.get("IDEAL", 0))
        good_count  = int(label_counts.get("GOOD", 0))
        weak_count  = int(label_counts.get("WEAK", 0))

        # Top-N diverse key frames
        top_indices = select_top_n_diverse(df, top_n)

        # Extract thumbnails for top frames
        cap2 = cv2.VideoCapture(tmp_path)
        key_frames_data = []
        frame_lookup = {int(r["Frame"]): r for r in results}

        for target_idx in top_indices:
            cap2.set(cv2.CAP_PROP_POS_FRAMES, target_idx)
            ret, frame = cap2.read()
            if not ret:
                continue
            b64 = frame_to_base64_jpeg(frame)
            row = df[df["Frame"] == target_idx].iloc[0]
            key_frames_data.append({
                "frame_index":  int(target_idx),
                "sss_smooth":   float(row["SSS_smooth"]),
                "label_smooth": str(row["Label_smooth"]),
                "image_b64":    b64,
            })
        cap2.release()

        # Build frame_scores list for API response
        frame_scores = []
        for _, row in df.iterrows():
            frame_scores.append({
                "frame":       int(row["Frame"]),
                "texture":     float(row["Texture"]),
                "edge":        float(row["Edge"]),
                "motion":      float(row["Motion"]),
                "exposure":    float(row["Exposure"]),
                "compression": float(row["Compression"]),
                "saturation":  float(row["Saturation"]),
                "scene_cut":   float(row["SceneCut"]),
                "sss":         float(row["SSS"]),
                "sss_smooth":  float(row["SSS_smooth"]),
                "label":       str(row["Label"]),
                "label_smooth":str(row["Label_smooth"]),
            })

        # CSV
        csv_data = df.to_csv(index=False)

        return {
            "filename":     filename,
            "total_frames": int(frame_idx),
            "fps":          float(fps),
            "ideal_count":  ideal_count,
            "good_count":   good_count,
            "weak_count":   weak_count,
            "frame_scores": frame_scores,
            "key_frames":   key_frames_data,
            "csv_data":     csv_data,
        }

    finally:
        os.unlink(tmp_path)
