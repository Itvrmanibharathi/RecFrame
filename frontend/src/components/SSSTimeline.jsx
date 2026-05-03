import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

const LABEL_COLOR = { IDEAL: "#22c55e", GOOD: "#f59e0b", WEAK: "#ef4444" };

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-gray-400 mb-1">Frame <span className="text-white font-bold">{d.frame}</span></p>
      <p className="text-gray-400">SSS: <span className="text-white font-bold">{d.sss_smooth?.toFixed(4)}</span></p>
      <p className="mt-1">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-white font-semibold text-xs"
          style={{ background: LABEL_COLOR[d.label_smooth] + "33", color: LABEL_COLOR[d.label_smooth] }}
        >
          {d.label_smooth}
        </span>
      </p>
    </div>
  );
}

export default function SSSTimeline({ frameScores }) {
  if (!frameScores?.length) return null;

  // Sample for performance: max 600 bars rendered
  const raw = frameScores;
  const step = Math.max(1, Math.floor(raw.length / 600));
  const data = raw.filter((_, i) => i % step === 0);

  return (
    <div className="glass p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">SSS Timeline</h3>
          <p className="text-gray-500 text-sm">Smoothed Stego-Suitability Score per frame</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {[["IDEAL", "#22c55e"], ["GOOD", "#f59e0b"], ["WEAK", "#ef4444"]].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: c }} />
              <span className="text-gray-400">{l}</span>
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="frame"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
          <ReferenceLine y={0.50} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value: "IDEAL 0.50", fill: "#22c55e", fontSize: 10, position: "insideTopRight" }} />
          <ReferenceLine y={0.28} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value: "GOOD 0.28", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }} />
          <Bar dataKey="sss_smooth" radius={[1, 1, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={LABEL_COLOR[entry.label_smooth] || "#6b7280"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
