import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, LogOut, Download, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import client from "../api/client";

import VideoUpload  from "../components/VideoUpload";
import StatsCards   from "../components/StatsCards";
import SSSTimeline  from "../components/SSSTimeline";
import FeatureHeatmap from "../components/FeatureHeatmap";
import KeyFrameGallery from "../components/KeyFrameGallery";
import JobHistory   from "../components/JobHistory";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeJobId, setActiveJobId] = useState(null);
  const [jobResult, setJobResult] = useState(null);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);

  // ── Poll job until done ───────────────────────────────────────────────────
  const pollJob = useCallback(async (jobId) => {
    setPolling(true);
    setPollError("");
    const MAX_ATTEMPTS = 120; // 4 min max
    let attempts = 0;

    const tick = async () => {
      attempts++;
      try {
        const { data } = await client.get(`/api/jobs/${jobId}`);
        if (data.status === "done") {
          setJobResult(data.result);
          setPolling(false);
        } else if (data.status === "error") {
          setPollError(data.error_msg || "Analysis failed");
          setPolling(false);
        } else if (attempts < MAX_ATTEMPTS) {
          setTimeout(tick, 3000);
        } else {
          setPollError("Analysis is taking too long. Check back later.");
          setPolling(false);
        }
      } catch {
        if (attempts < MAX_ATTEMPTS) setTimeout(tick, 5000);
        else { setPollError("Could not reach server."); setPolling(false); }
      }
    };
    tick();
  }, []);

  const handleJobStarted = (jobId) => {
    setActiveJobId(jobId);
    setJobResult(null);
    setPollError("");
    pollJob(jobId);
  };

  const handleSelectJob = useCallback(async (jobId) => {
    setActiveJobId(jobId);
    setJobResult(null);
    setPollError("");
    try {
      const { data } = await client.get(`/api/jobs/${jobId}`);
      if (data.result) setJobResult(data.result);
    } catch { setPollError("Failed to load job result."); }
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  // ── CSV download ───────────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!jobResult?.csv_data) return;
    const blob = new Blob([jobResult.csv_data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recframe_${jobResult.filename || "results"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasResult = !!jobResult;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-500/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">RecFrame</span>
            <span className="text-brand-400 text-xs font-medium hidden sm:inline">v2</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm hidden sm:inline">{user?.email}</span>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Upload */}
          <div className="glass-dark p-6">
            <h2 className="text-white font-semibold text-lg mb-1">Upload Video</h2>
            <p className="text-gray-500 text-sm mb-4">Max 50 MB · MP4, MOV, AVI, MKV, WEBM</p>
            <VideoUpload onJobStarted={handleJobStarted} />
          </div>

          {/* Job History */}
          <div className="glass-dark p-6">
            <JobHistory activeJobId={activeJobId} onSelectJob={handleSelectJob} />
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">

          {/* Empty state */}
          {!polling && !hasResult && !pollError && (
            <div className="flex flex-col items-center justify-center h-96 glass text-center p-8 animate-fade-in">
              <div className="w-20 h-20 bg-brand-500/10 rounded-3xl flex items-center justify-center mb-4">
                <Zap className="w-10 h-10 text-brand-500/60" />
              </div>
              <h3 className="text-white font-semibold text-xl mb-2">Ready to Analyse</h3>
              <p className="text-gray-500 max-w-sm">
                Upload a video on the left to score every frame using 7 visual-quality features
                and identify IDEAL, GOOD, and WEAK frames.
              </p>
            </div>
          )}

          {/* Polling spinner */}
          {polling && (
            <div className="flex flex-col items-center justify-center h-72 glass text-center p-8 animate-pulse2">
              <Loader2 className="w-12 h-12 text-brand-400 animate-spin mb-4" />
              <p className="text-white font-semibold text-lg">Analysing Frames…</p>
              <p className="text-gray-500 text-sm mt-1">
                Extracting Texture · Edge · Motion · Exposure · Compression · Saturation per frame
              </p>
              <p className="text-gray-600 text-xs mt-4">This may take 1–3 minutes for longer videos</p>
            </div>
          )}

          {/* Poll error */}
          {pollError && !polling && (
            <div className="glass bg-red-500/10 border-red-500/30 p-6 text-red-400">
              <p className="font-semibold mb-1">Analysis Error</p>
              <p className="text-sm">{pollError}</p>
            </div>
          )}

          {/* Results */}
          {hasResult && !polling && (
            <>
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-xl">{jobResult.filename}</h2>
                  <p className="text-gray-500 text-sm">Analysis complete</p>
                </div>
                <button
                  id="download-csv-btn"
                  onClick={downloadCSV}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {/* Stats */}
              <StatsCards
                idealCount={jobResult.ideal_count}
                goodCount={jobResult.good_count}
                weakCount={jobResult.weak_count}
                totalFrames={jobResult.total_frames}
                fps={jobResult.fps}
              />

              {/* SSS Timeline */}
              <SSSTimeline frameScores={jobResult.frame_scores} />

              {/* Feature Heatmap (collapsible) */}
              <div>
                <button
                  id="toggle-heatmap-btn"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="w-full flex items-center justify-between glass p-4 text-white font-semibold hover:bg-white/10 transition-all"
                >
                  <span>Feature Heatmap</span>
                  {showHeatmap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showHeatmap && <div className="mt-2"><FeatureHeatmap frameScores={jobResult.frame_scores} /></div>}
              </div>

              {/* Key Frames */}
              <KeyFrameGallery keyFrames={jobResult.key_frames} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
