import { useState } from "react";
import { ZoomIn } from "lucide-react";

const CHIP = {
  IDEAL: "chip-ideal",
  GOOD:  "chip-good",
  WEAK:  "chip-weak",
};

function FrameModal({ frame, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-dark p-4 max-w-2xl w-full rounded-2xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">Frame #{frame.frame_index}</span>
            <span className={CHIP[frame.label_smooth] || "chip-weak"}>{frame.label_smooth}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <img
          src={`data:image/jpeg;base64,${frame.image_b64}`}
          alt={`Frame ${frame.frame_index}`}
          className="w-full rounded-xl object-contain max-h-[70vh]"
        />
        <p className="text-gray-500 text-sm mt-2 text-center">
          SSS Score: <strong className="text-white">{frame.sss_smooth.toFixed(4)}</strong>
        </p>
      </div>
    </div>
  );
}

export default function KeyFrameGallery({ keyFrames }) {
  const [selected, setSelected] = useState(null);

  if (!keyFrames?.length) return null;

  return (
    <div className="glass p-6 animate-fade-in">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg">Key Frames</h3>
        <p className="text-gray-500 text-sm">Top {keyFrames.length} best frames, spatially distributed across the video</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {keyFrames.map((kf) => (
          <div
            key={kf.frame_index}
            id={`frame-thumb-${kf.frame_index}`}
            className="group relative rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-500/60 transition-all duration-200 hover:scale-105"
            onClick={() => setSelected(kf)}
          >
            <img
              src={`data:image/jpeg;base64,${kf.image_b64}`}
              alt={`Frame ${kf.frame_index}`}
              className="w-full h-28 object-cover"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            {/* Badges */}
            <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between">
              <span className="text-white text-xs font-bold opacity-80">#{kf.frame_index}</span>
              <span className={CHIP[kf.label_smooth] || "chip-weak"}>{kf.label_smooth}</span>
            </div>
            {/* SSS score top-right */}
            <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-lg font-mono">
              {kf.sss_smooth.toFixed(3)}
            </div>
          </div>
        ))}
      </div>

      {selected && <FrameModal frame={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
