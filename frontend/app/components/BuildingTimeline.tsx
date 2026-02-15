"use client";
import { useMemo, useRef, useState, useEffect } from "react";

interface TimelineProps {
  violations: any[];
  ecbViolations: any[];
  complaints: any[];
  permits: any[];
  firstTcoDate?: string;
  latestTcoDate?: string;
  tcoExpired?: boolean;
}

interface TooltipInfo {
  x: number;
  y: number;
  lines: string[];
}

function parseDate(d: any): Date | null {
  if (!d) return null;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BuildingTimeline({
  violations,
  ecbViolations,
  complaints,
  permits,
  firstTcoDate,
  latestTcoDate,
  tcoExpired,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { allDates, minTime, maxTime, timeSpanMs } = useMemo(() => {
    const dates: number[] = [];
    const push = (d: any) => {
      const p = parseDate(d);
      if (p) dates.push(p.getTime());
    };
    violations.forEach((v) => push(v.inspectiondate));
    ecbViolations.forEach((v) => { push(v.issue_date); });
    complaints.forEach((c) => push(c.date_entered));
    permits.forEach((p) => { push(p.latest_action_date); push(p.signoff_date); });
    push(firstTcoDate);
    push(latestTcoDate);

    if (dates.length === 0) return { allDates: dates, minTime: 0, maxTime: 0, timeSpanMs: 0 };

    const pad = 180 * 24 * 3600 * 1000; // 6 months
    const mn = Math.min(...dates) - pad;
    const mx = Math.max(...dates, Date.now()) + pad;
    return { allDates: dates, minTime: mn, maxTime: mx, timeSpanMs: mx - mn };
  }, [violations, ecbViolations, complaints, permits, firstTcoDate, latestTcoDate]);

  if (allDates.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        No timeline data available
      </div>
    );
  }

  const labelW = 70;
  const chartW = width - labelW;
  const laneH = 30;
  const gap = 4;
  const lanes = ["TCO", "Permits", "HPD", "ECB", "Complaints"];
  const totalH = lanes.length * (laneH + gap) + 30; // +30 for x-axis
  const xScale = (t: number) => labelW + ((t - minTime) / timeSpanMs) * chartW;

  // Year markers
  const startYear = new Date(minTime).getFullYear();
  const endYear = new Date(maxTime).getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const laneY = (i: number) => i * (laneH + gap);

  const show = (e: React.MouseEvent, lines: string[]) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, lines });
  };
  const hide = () => setTooltip(null);

  // Penalty range for ECB sizing
  const penalties = ecbViolations.map((v) => parseFloat(v.penality_imposed) || 0);
  const maxPenalty = Math.max(1, ...penalties);

  const now = Date.now();

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <svg width={Math.max(width, chartW)} height={totalH} className="text-gray-700 dark:text-gray-300">
        {/* Year grid lines */}
        {years.map((y) => {
          const t = new Date(y, 0, 1).getTime();
          if (t < minTime || t > maxTime) return null;
          const x = xScale(t);
          return (
            <g key={y}>
              <line x1={x} y1={0} x2={x} y2={totalH - 25} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
              <text x={x} y={totalH - 8} textAnchor="middle" fill="currentColor" fontSize={10} opacity={0.5}>
                {y}
              </text>
            </g>
          );
        })}

        {/* Lane labels */}
        {lanes.map((label, i) => (
          <text key={label} x={4} y={laneY(i) + laneH / 2 + 4} fill="currentColor" fontSize={10} fontWeight={500} opacity={0.6}>
            {label}
          </text>
        ))}

        {/* TCO lane (index 0) */}
        {firstTcoDate && (() => {
          const tcoStart = parseDate(firstTcoDate)?.getTime();
          const tcoEnd = parseDate(latestTcoDate)?.getTime();
          if (!tcoStart) return null;
          const y0 = laneY(0);
          const elements = [];
          if (tcoEnd) {
            elements.push(
              <rect key="tco-active" x={xScale(tcoStart)} y={y0 + 4} width={Math.max(1, xScale(tcoEnd) - xScale(tcoStart))} height={laneH - 8}
                fill="#22c55e" opacity={0.3} rx={3}
                onMouseMove={(e) => show(e, [`TCO Active: ${fmt(new Date(tcoStart))} – ${fmt(new Date(tcoEnd))}`])}
                onMouseLeave={hide} />
            );
            if (tcoExpired) {
              elements.push(
                <rect key="tco-expired" x={xScale(tcoEnd)} y={y0 + 4} width={Math.max(1, xScale(now) - xScale(tcoEnd))} height={laneH - 8}
                  fill="#ef4444" opacity={0.3} rx={3}
                  onMouseMove={(e) => show(e, [`TCO EXPIRED since ${fmt(new Date(tcoEnd))}`])}
                  onMouseLeave={hide} />
              );
            }
          }
          return elements;
        })()}

        {/* Permits lane (index 1) */}
        {permits.map((p, i) => {
          const start = parseDate(p.latest_action_date)?.getTime();
          if (!start) return null;
          const end = parseDate(p.signoff_date)?.getTime() || now;
          const y0 = laneY(1);
          const signedOff = !!p.signed_off;
          const tier = (p.risk_tier || "").toLowerCase();
          const fill = tier.includes("critical") || tier.includes("high") ? "#ef4444" : tier.includes("warning") ? "#f97316" : "#22c55e";
          return (
            <rect key={`permit-${i}`} x={xScale(start)} y={y0 + 11} width={Math.max(2, xScale(end) - xScale(start))} height={8}
              fill={fill} opacity={signedOff ? 0.3 : 0.85} rx={3}
              onMouseMove={(e) => show(e, [
                `Permit: ${p.job_type || "Unknown"}`,
                `${fmt(new Date(start))}${signedOff ? ` – ${fmt(new Date(end))}` : " – Active"}`,
                signedOff ? "Signed off" : "In progress",
              ])}
              onMouseLeave={hide} />
          );
        })}

        {/* HPD Violations lane (index 2) */}
        {violations.map((v, i) => {
          const t = parseDate(v.inspectiondate)?.getTime();
          if (!t) return null;
          const y0 = laneY(2);
          const cls = (v.class || "").toUpperCase();
          const fill = cls === "C" ? "#ef4444" : cls === "B" ? "#f97316" : "#9ca3af";
          const open = (v.violationstatus || "").toLowerCase() === "open";
          return (
            <circle key={`hpd-${i}`} cx={xScale(t)} cy={y0 + laneH / 2} r={4}
              fill={fill} opacity={open ? 0.9 : 0.3}
              onMouseMove={(e) => show(e, [
                `HPD Class ${cls} – ${open ? "Open" : "Closed"}`,
                fmt(new Date(t)),
                v.novdescription?.slice(0, 80) || "",
              ])}
              onMouseLeave={hide} />
          );
        })}

        {/* ECB Violations lane (index 3) */}
        {ecbViolations.map((v, i) => {
          const t = parseDate(v.issue_date)?.getTime();
          if (!t) return null;
          const y0 = laneY(3);
          const pen = parseFloat(v.penality_imposed) || 0;
          const r = 4 + (pen / maxPenalty) * 4;
          const resolved = (v.ecb_violation_status || "").toLowerCase().includes("resolve");
          return (
            <circle key={`ecb-${i}`} cx={xScale(t)} cy={y0 + laneH / 2} r={r}
              fill="#a855f7" opacity={resolved ? 0.3 : 0.85}
              onMouseMove={(e) => show(e, [
                `ECB – ${resolved ? "Resolved" : "Active"}`,
                fmt(new Date(t)),
                pen > 0 ? `Penalty: $${pen.toLocaleString()}` : "No penalty",
                v.violation_type?.slice(0, 60) || "",
              ])}
              onMouseLeave={hide} />
          );
        })}

        {/* Complaints lane (index 4) */}
        {complaints.map((c, i) => {
          const t = parseDate(c.date_entered)?.getTime();
          if (!t) return null;
          const y0 = laneY(4);
          const closed = (c.status || "").toLowerCase() !== "active";
          return (
            <circle key={`comp-${i}`} cx={xScale(t)} cy={y0 + laneH / 2} r={4}
              fill="#3b82f6" opacity={closed ? 0.3 : 0.85}
              onMouseMove={(e) => show(e, [
                `Complaint – ${closed ? "Closed" : "Active"}`,
                fmt(new Date(t)),
                c.complaint_category?.slice(0, 60) || "",
              ])}
              onMouseLeave={hide} />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.lines.filter(Boolean).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
