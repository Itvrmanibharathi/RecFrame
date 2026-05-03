import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const CONFIG = {
  IDEAL: {
    label: "IDEAL Frames",
    desc: "SSS ≥ 0.50 — best quality",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    glow: "shadow-green-500/10",
  },
  GOOD: {
    label: "GOOD Frames",
    desc: "SSS 0.28–0.50",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "shadow-amber-500/10",
  },
  WEAK: {
    label: "WEAK Frames",
    desc: "SSS < 0.28 — low quality",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    glow: "shadow-red-500/10",
  },
};

export default function StatsCards({ idealCount, goodCount, weakCount, totalFrames, fps }) {
  const items = [
    { key: "IDEAL", count: idealCount ?? "—" },
    { key: "GOOD",  count: goodCount  ?? "—" },
    { key: "WEAK",  count: weakCount  ?? "—" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map(({ key, count }) => {
        const cfg = CONFIG[key];
        const Icon = cfg.icon;
        const pct = totalFrames && count !== "—"
          ? ((count / totalFrames) * 100).toFixed(1)
          : null;

        return (
          <div
            key={key}
            className={`glass ${cfg.bg} border ${cfg.border} p-5 shadow-xl ${cfg.glow} animate-slide-up`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              {pct && (
                <span className={`text-xs font-semibold ${cfg.color} bg-white/5 px-2 py-1 rounded-lg`}>
                  {pct}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-white mb-1">{count.toLocaleString()}</p>
            <p className="text-sm font-semibold text-gray-300">{cfg.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
          </div>
        );
      })}

      {/* Video info */}
      {totalFrames && (
        <div className="sm:col-span-3 glass p-4 flex flex-wrap gap-6 text-sm animate-fade-in">
          <span className="text-gray-400">
            Total Frames: <strong className="text-white">{totalFrames.toLocaleString()}</strong>
          </span>
          {fps && (
            <span className="text-gray-400">
              FPS: <strong className="text-white">{fps.toFixed(1)}</strong>
            </span>
          )}
          {fps && totalFrames && (
            <span className="text-gray-400">
              Duration: <strong className="text-white">{(totalFrames / fps).toFixed(1)}s</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
