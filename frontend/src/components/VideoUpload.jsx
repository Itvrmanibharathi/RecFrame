import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Film, AlertCircle, CheckCircle2 } from "lucide-react";
import client from "../api/client";

const MAX_MB = 50;
const ACCEPT = { "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] };

export default function VideoUpload({ onJobStarted }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onDrop = useCallback((accepted, rejected) => {
    setError("");
    setSuccess("");
    if (rejected.length > 0) {
      const reason = rejected[0].errors?.[0]?.message || "File rejected";
      setError(reason);
      return;
    }
    const f = accepted[0];
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    maxSize: MAX_MB * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await client.post("/api/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(`Analysis started! Job ID: ${data.job_id}`);
      setFile(null);
      onJobStarted?.(data.job_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        id="video-dropzone"
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
          ${isDragActive
            ? "border-brand-500 bg-brand-500/10 scale-[1.01]"
            : "border-white/20 hover:border-brand-500/60 hover:bg-white/5"
          }`}
      >
        <input id="video-file-input" {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
            ${isDragActive ? "bg-brand-500/20" : "bg-white/5"}`}>
            <UploadCloud className={`w-8 h-8 ${isDragActive ? "text-brand-400" : "text-gray-500"}`} />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">
              {isDragActive ? "Drop your video here" : "Drag & drop a video"}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              or <span className="text-brand-400 underline">browse files</span>
            </p>
          </div>
          <p className="text-gray-600 text-xs">MP4 · MOV · AVI · MKV · WEBM · max {MAX_MB} MB</p>
        </div>
      </div>

      {/* Selected file */}
      {file && (
        <div className="glass p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Film className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{file.name}</p>
            <p className="text-gray-500 text-xs">{formatSize(file.size)}</p>
          </div>
          <button
            id="clear-file-btn"
            onClick={(e) => { e.stopPropagation(); setFile(null); setError(""); }}
            className="text-gray-500 hover:text-white text-lg leading-none"
          >×</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl p-3 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Upload button */}
      <button
        id="start-analysis-btn"
        onClick={handleUpload}
        disabled={!file || uploading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Uploading & Analysing…
          </>
        ) : (
          "Start Analysis"
        )}
      </button>
    </div>
  );
}
