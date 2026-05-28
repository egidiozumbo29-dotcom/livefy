"use client";

import { useRef, useState } from "react";

export type DailyPoint = {
  date: string;
  grossEur: number;
  ownerEur: number;
  events: number;
};

const W = 800;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

function toPath(points: { x: number; y: number }[], chartH: number): string {
  if (points.length === 0) return "";
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return `${d} L${last.x.toFixed(1)},${chartH} L${first.x.toFixed(1)},${chartH} Z`;
}

export function EarningsChart({ data }: { data: DailyPoint[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DailyPoint } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Nessun dato nel periodo selezionato.
      </p>
    );
  }

  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => d.grossEur), 1);

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const yScale = (v: number) => PAD.top + cH - (v / maxVal) * cH;

  const grossPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.grossEur) }));
  const ownerPts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.ownerEur) }));

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    val: maxVal * r,
    y: yScale(maxVal * r),
  }));

  const xTickStep = Math.ceil(data.length / 6);
  const xTicks = data
    .map((d, i) => ({ label: d.date.slice(5), x: xScale(i), i }))
    .filter((t) => t.i % xTickStep === 0 || t.i === data.length - 1);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((mx - PAD.left) / cW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setTooltip({ x: xScale(clamped), y: yScale(data[clamped].grossEur), point: data[clamped] });
  };

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="flex gap-4 mb-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-emerald-400 opacity-80" />
          Lordo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-amber-400 opacity-80" />
          Owner netto
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gOwner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>

        {yTicks.map((t) => (
          <g key={t.y}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#2a2a2a" strokeWidth={1} />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize={9} fill="#666">
              €{t.val.toFixed(0)}
            </text>
          </g>
        ))}

        {xTicks.map((t) => (
          <text key={t.i} x={t.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#666">
            {t.label}
          </text>
        ))}

        <path d={toPath(grossPts, PAD.top + cH)} fill="url(#gGross)" />
        <path
          d={grossPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#34d399"
          strokeWidth={2}
        />

        <path d={toPath(ownerPts, PAD.top + cH)} fill="url(#gOwner)" />
        <path
          d={ownerPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
        />

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + cH} stroke="#555" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#34d399" />
          </g>
        )}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute top-8 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(tooltip.x / W * 100, 75) + "%" }}
        >
          <p className="font-semibold text-text">{tooltip.point.date}</p>
          <p className="text-emerald-300">Lordo: €{tooltip.point.grossEur.toFixed(2)}</p>
          <p className="text-amber-300">Owner: €{tooltip.point.ownerEur.toFixed(2)}</p>
          <p className="text-muted">Eventi: {tooltip.point.events}</p>
        </div>
      )}
    </div>
  );
}
