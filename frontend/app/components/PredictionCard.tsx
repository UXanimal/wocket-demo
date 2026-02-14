"use client";
import { useState, useEffect } from "react";

interface Prediction {
  category: string;
  category_name: string;
  predicted_days: number;
  historical_avg_days: number | null;
  city_avg_days: number;
  confidence: "high" | "medium" | "low";
  complaint_count: number;
}

interface PredictionData {
  predictions: Prediction[] | null;
  building_avg_predicted: number | null;
  city_avg: number;
  error?: string;
}

function formatDays(days: number): string {
  if (days >= 365) return `${Math.round(days / 30)} mo`;
  if (days >= 30) return `${Math.round(days / 30)} mo`;
  return `${days}d`;
}

function confidenceBadge(c: string) {
  if (c === "high") return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">High</span>;
  if (c === "medium") return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">Med</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">Low</span>;
}

function comparisonArrow(predicted: number, cityAvg: number) {
  const diff = predicted - cityAvg;
  const pct = Math.round(Math.abs(diff) / cityAvg * 100);
  if (pct < 5) return <span className="text-gray-400 dark:text-gray-500 text-xs">≈ avg</span>;
  if (diff < 0) return <span className="text-green-600 dark:text-green-400 text-xs font-medium">↓ {pct}% faster</span>;
  return <span className="text-red-500 dark:text-red-400 text-xs font-medium">↑ {pct}% slower</span>;
}

export default function PredictionCard({ bin, apiBase }: { bin: string; apiBase: string }) {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/building/${bin}/predictions`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [bin, apiBase]);

  if (loading) return null;
  if (!data?.predictions || data.predictions.length === 0) return null;

  const top = expanded ? data.predictions : data.predictions.slice(0, 5);
  const hasMore = data.predictions.length > 5;

  return (
    <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Complaint Resolution Predictions</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ML-predicted resolution time based on building history, location, and violation profile</p>
          </div>
          {data.building_avg_predicted && data.city_avg && (
            <div className="text-right shrink-0 ml-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDays(data.building_avg_predicted)}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">avg predicted</div>
              {comparisonArrow(data.building_avg_predicted, data.city_avg)}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 md:px-6 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="pb-2 pr-2 font-medium">Category</th>
              <th className="pb-2 pr-2 font-medium text-right">Predicted</th>
              <th className="pb-2 pr-2 font-medium text-right hidden sm:table-cell">Building Avg</th>
              <th className="pb-2 pr-2 font-medium text-right hidden sm:table-cell">City Avg</th>
              <th className="pb-2 font-medium text-right">vs City</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.category} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-900 dark:text-gray-100">{p.category_name || p.category}</span>
                    {confidenceBadge(p.confidence)}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{p.complaint_count} complaints</div>
                </td>
                <td className="py-2 pr-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatDays(p.predicted_days)}</td>
                <td className="py-2 pr-2 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">{p.historical_avg_days ? formatDays(p.historical_avg_days) : "—"}</td>
                <td className="py-2 pr-2 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDays(p.city_avg_days)}</td>
                <td className="py-2 text-right">{comparisonArrow(p.predicted_days, p.city_avg_days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            {expanded ? "Show less" : `Show all ${data.predictions.length} categories →`}
          </button>
        )}
      </div>
    </div>
  );
}
