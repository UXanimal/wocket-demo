"use client";
import { useMemo, useState } from "react";

interface HeatmapProps {
  violations: any[];
  ecbViolations: any[];
  complaints: any[];
  permits: any[];
}

function parseDate(d: any): string | null {
  if (!d) return null;
  const p = new Date(d);
  if (isNaN(p.getTime())) return null;
  return p.toISOString().slice(0, 10);
}

const COLORS_LIGHT = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const COLORS_DARK = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const CELL = 11;
const GAP = 2;
const CELL_TOTAL = CELL + GAP;

interface DayData {
  date: string;
  total: number;
  violations: number;
  ecb: number;
  complaints: number;
  permits: number;
}

export default function ActivityHeatmap({ violations, ecbViolations, complaints, permits }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  if (typeof window !== "undefined") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.matches !== isDark) setIsDark(mq.matches);
  }

  const { grid, weeks, maxCount, monthLabels } = useMemo(() => {
    // Count events per day
    const counts: Record<string, { violations: number; ecb: number; complaints: number; permits: number }> = {};
    const inc = (date: string | null, key: "violations" | "ecb" | "complaints" | "permits") => {
      if (!date) return;
      if (!counts[date]) counts[date] = { violations: 0, ecb: 0, complaints: 0, permits: 0 };
      counts[date][key]++;
    };

    violations.forEach((v) => inc(parseDate(v.inspectiondate), "violations"));
    ecbViolations.forEach((v) => inc(parseDate(v.issue_date), "ecb"));
    complaints.forEach((c) => inc(parseDate(c.date_entered), "complaints"));
    permits.forEach((p) => { inc(parseDate(p.latest_action_date), "permits"); });

    // Build grid for last 2 years
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 2);
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay());

    const grid: DayData[][] = [];
    let week: DayData[] = [];
    let maxCount = 0;
    const monthLabels: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;
    let weekIdx = 0;

    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const c = counts[dateStr] || { violations: 0, ecb: 0, complaints: 0, permits: 0 };
      const total = c.violations + c.ecb + c.complaints + c.permits;
      if (total > maxCount) maxCount = total;

      const month = cursor.getMonth();
      if (month !== lastMonth && cursor.getDay() === 0) {
        monthLabels.push({
          label: cursor.toLocaleDateString("en-US", { month: "short" }),
          weekIdx,
        });
        lastMonth = month;
      }

      week.push({ date: dateStr, total, ...c });

      if (cursor.getDay() === 6) {
        grid.push(week);
        week = [];
        weekIdx++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.length > 0) grid.push(week);

    return { grid, weeks: grid.length, maxCount, monthLabels };
  }, [violations, ecbViolations, complaints, permits]);

  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const getColor = (count: number) => {
    if (count === 0) return colors[0];
    if (maxCount <= 0) return colors[0];
    const idx = Math.min(4, Math.ceil((count / maxCount) * 4));
    return colors[idx];
  };

  const labelW = 28;
  const svgW = labelW + weeks * CELL_TOTAL;
  const svgH = 7 * CELL_TOTAL + 20; // +20 for month labels

  const totalEvents = violations.length + ecbViolations.length + complaints.length + permits.length;

  if (totalEvents === 0) {
    return (
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        No activity data available
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-2">
        <svg width={svgW} height={svgH} className="block">
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelW + m.weekIdx * CELL_TOTAL}
              y={10}
              fill="currentColor"
              className="text-gray-400 dark:text-gray-500"
              fontSize={9}
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={i}
                x={0}
                y={18 + i * CELL_TOTAL + CELL - 1}
                fill="currentColor"
                className="text-gray-400 dark:text-gray-500"
                fontSize={9}
              >
                {label}
              </text>
            ) : null
          )}

          {/* Cells */}
          {grid.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={labelW + wi * CELL_TOTAL}
                y={18 + di * CELL_TOTAL}
                width={CELL}
                height={CELL}
                rx={2}
                fill={getColor(day.total)}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parent = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                  if (parent) {
                    setTooltip({
                      x: rect.left - parent.left + rect.width / 2,
                      y: rect.top - parent.top - 4,
                      day,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 dark:text-gray-500">
        <span>Less</span>
        {colors.map((c, i) => (
          <span
            key={i}
            className="inline-block rounded-sm"
            style={{ width: CELL, height: CELL, backgroundColor: c }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="font-medium">{new Date(tooltip.day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
          {tooltip.day.total === 0 ? (
            <div className="text-gray-400">No activity</div>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              <div>{tooltip.day.total} event{tooltip.day.total !== 1 ? "s" : ""}</div>
              {tooltip.day.violations > 0 && <div className="text-red-300">HPD: {tooltip.day.violations}</div>}
              {tooltip.day.ecb > 0 && <div className="text-purple-300">ECB: {tooltip.day.ecb}</div>}
              {tooltip.day.complaints > 0 && <div className="text-blue-300">Complaints: {tooltip.day.complaints}</div>}
              {tooltip.day.permits > 0 && <div className="text-green-300">Permits: {tooltip.day.permits}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
