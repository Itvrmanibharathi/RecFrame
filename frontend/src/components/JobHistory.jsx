import { useEffect, useState, useCallback } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import client from "../api/client";

const STATUS_CFG = {
  processing: { icon: Loader2, color: "text-blue-400",  spin: true,  label: "Processing…" },
  done:       { icon: CheckCircle2, color: "text-green-400", spin: false, label: "Done" },
  error:      { icon: XCircle, color: "text-red-400",   spin: false, label: "Error" },
};

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function JobHistory({ activeJobId, onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/api/jobs?limit=20");
      setJobs(data);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  // Poll every 4 s while there's a processing job
  useEffect(() => {
    fetchJobs();
    const hasProcessing = jobs.some((j) => j.status === "processing");
    if (!hasProcessing && !activeJobId) return;
    const timer = setInterval(fetchJobs, 4000);
    return () => clearInterval(timer);
  }, [fetchJobs, activeJobId, jobs.length]);

  if (!jobs.length && !loading) return (
    <div className="text-center py-8 text-gray-600 text-sm">No jobs yet. Upload a video above!</div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Recent Jobs</h3>
        <button
          id="refresh-jobs-btn"
          onClick={fetchJobs}
          disabled={loading}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {jobs.map((job) => {
        const cfg = STATUS_CFG[job.status] || STATUS_CFG.processing;
        const Icon = cfg.icon;
        const isActive = job.id === activeJobId;

        return (
          <div
            key={job.id}
            id={`job-item-${job.id}`}
            onClick={() => job.status === "done" && onSelectJob?.(job.id)}
            className={`glass p-3 flex items-start gap-3 transition-all duration-200
              ${job.status === "done" ? "cursor-pointer hover:bg-white/10 hover:border-brand-500/40" : "opacity-80"}
              ${isActive ? "border-brand-500/50 bg-brand-500/5" : ""}`}
          >
            <div className={`mt-0.5 ${cfg.color}`}>
              <Icon className={`w-4 h-4 ${cfg.spin ? "animate-spin" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{job.filename}</p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                <span className={cfg.color}>{cfg.label}</span>
                {job.status === "done" && (
                  <>
                    <span>·</span>
                    <span className="text-green-400">{job.ideal_count} IDEAL</span>
                    <span className="text-amber-400">{job.good_count} GOOD</span>
                    <span className="text-red-400">{job.weak_count} WEAK</span>
                  </>
                )}
              </div>
              {job.error_msg && (
                <p className="text-red-400 text-xs mt-0.5 truncate">{job.error_msg}</p>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-600 text-xs shrink-0">
              <Clock className="w-3 h-3" />
              {fmtDate(job.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
