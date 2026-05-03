import { useMemo } from "react";

const FEATURES = ["texture", "edge", "motion", "exposure", "compression", "saturation"];
const FEATURE_LABELS = {
  texture: "Texture", edge: "Edge Density", motion: "Motion Stability",
  exposure: "Exposure", compression: "Compression", saturation: "Saturation",
};

/**
 * Colour an 0–1 score: red (0) → yellow (0.5) → green (1)
 */
function scoreToColor(v) {
  const h = v * 120; // 0 = red, 120 = green
  return `hsl(${h}, 70%, 40%)`;
}

export default function FeatureHeatmap({ frameScores }) {
  if (!frameScores?.length) return null;

  // Sample: max 200 columns for performance
  const step = Math.max(1, Math.floor(frameScores.length / 200));
  const sampled = useMemo(
    () => frameScores.filter((_, i) => i % step === 0),
    [frameScores, step]
  );

  return (
    <div className="glass p-6 animate-fade-in">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg">Feature Heatmap</h3>
        <p className="text-gray-500 text-sm">Per-feature scores across all frames — red = low, green = high</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {FEATURES.map((feat) => (
            <div key={feat} className="flex items-center gap-3 mb-1.5">
              <span className="text-gray-400 text-xs w-28 shrink-0 text-right">{FEATURE_LABELS[feat]}</span>
              <div className="flex flex-1 gap-px h-6 rounded overflow-hidden">
                {sampled.map((f, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[2px] rounded-sm"
                    style={{ background: scoreToColor(f[feat] ?? 0) }}
                    title={`Frame ${f.frame}: ${feat} = ${(f[feat] ?? 0).toFixed(3)}`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Colour scale legend */}
          <div className="flex items-center gap-2 mt-4 ml-[7.5rem]">
            <span className="text-gray-500 text-xs">0.0</span>
            <div className="flex-1 h-2 rounded" style={{
              background: "linear-gradient(to right, hsl(0,70%,40%), hsl(60,70%,40%), hsl(120,70%,40%))"
            }} />
            <span className="text-gray-500 text-xs">1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
