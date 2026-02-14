"use client";
import { Suspense, useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const OwnerMap = dynamic(() => import("../../components/OwnerMap"), { ssr: false });

interface Building {
  bin: string;
  address: string;
  aliases: string | null;
  borough: string;
  zip: string;
  score_grade: string | null;
  open_class_c: number | null;
  total_hpd_violations: number | null;
  total_ecb_violations: number | null;
  ecb_penalties: number | null;
  co_status: string | null;
  tco_expired: boolean;
  unsigned_jobs: number | null;
  owner_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface Summary {
  total_buildings: number;
  total_open_class_c: number;
  total_hpd_violations: number;
  total_ecb_violations: number;
  total_ecb_penalties: number;
  expired_tcos: number;
  unsigned_jobs: number;
  total_litigations: number;
  open_litigations: number;
  grade_distribution: Record<string, number>;
  boroughs: string[];
}

function gradeColor(g: string | null) {
  if (!g) return "bg-gray-200 text-gray-700 dark:text-gray-200";
  if (g === "A") return "bg-green-500 text-white";
  if (g === "B") return "bg-blue-500 text-white";
  if (g === "C") return "bg-yellow-500 text-white";
  if (g === "D") return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

function gradeBadgeLight(g: string) {
  if (g === "A") return "bg-green-100 text-green-800 border-green-300";
  if (g === "B") return "bg-blue-100 text-blue-800 border-blue-300";
  if (g === "C") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (g === "D") return "bg-orange-100 text-orange-800 border-orange-300";
  if (g === "F") return "bg-red-100 text-red-800 dark:text-red-200 border-red-300";
  return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600";
}

function fmt$(v: any) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const GRADES = ["A", "B", "C", "D", "F"];

type SortKey = "address" | "borough" | "score_grade" | "open_class_c" | "total_hpd_violations" | "ecb_penalties" | "co_status";

export default function OwnerPageWrapper() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div></div>}><OwnerPage /></Suspense>;
}

function OwnerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ownerName = decodeURIComponent(params.name as string);
  const mode = searchParams.get("mode") || "";

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [boroughFilter, setBoroughFilter] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("open_class_c");
  const [sortAsc, setSortAsc] = useState(false);

  // Save scroll position on every scroll
  const scrollKey = `scroll:owner:${ownerName}`;
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollKey]);

  // Restore scroll after buildings render
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (buildings.length > 0 && !restored) {
      // Wait for DOM to paint the full list, then restore
      const t = setTimeout(() => {
        const saved = sessionStorage.getItem(scrollKey);
        if (saved) window.scrollTo(0, parseInt(saved, 10));
        setRestored(true);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [buildings, restored, scrollKey]);

  useEffect(() => {
    const modeParam = mode ? `&mode=${mode}` : "";
    fetch(`/api/owner?name=${encodeURIComponent(ownerName)}${modeParam}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => {
        setBuildings(data.buildings || []);
        setSummary(data.summary || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ownerName, mode]);

  const filtered = useMemo(() => {
    let list = buildings;
    if (gradeFilter) list = list.filter((b) => b.score_grade === gradeFilter);
    if (boroughFilter) list = list.filter((b) => b.borough === boroughFilter);
    if (addressSearch) {
      const q = addressSearch.toUpperCase();
      list = list.filter((b) => (b.address || "").toUpperCase().includes(q) || (b.aliases || "").toUpperCase().includes(q));
    }
    // Sort
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [buildings, gradeFilter, boroughFilter, addressSearch, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    return (
      <th className="pb-2 pr-2 cursor-pointer hover:text-gray-900 dark:text-gray-100 select-none" onClick={() => toggleSort(field)}>
        {label} {sortKey === field ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div></div>;
  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">{error}</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      {/* Header */}
      <header className="bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-bold text-lg shrink-0 font-nunito">Wocket</Link>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{ownerName}</h1>
          <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">Owner Portfolio</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-8 space-y-6">
        {/* Portfolio Summary */}
        {summary && (
          <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Portfolio Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-2xl font-bold font-nunito text-gray-900 dark:text-gray-100">{summary.total_buildings}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Buildings</div>
              </div>
              <div>
                <div className={`text-2xl font-bold font-nunito ${summary.total_open_class_c > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>{summary.total_open_class_c}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Open Class C</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-nunito text-gray-900 dark:text-gray-100">{summary.total_hpd_violations}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">HPD Violations</div>
              </div>
              <div>
                <div className={`text-2xl font-bold font-nunito ${summary.total_ecb_penalties > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>{fmt$(summary.total_ecb_penalties)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">ECB Penalties</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Grade distribution */}
              <div className="flex items-center gap-1">
                {GRADES.map((g) => {
                  const count = summary.grade_distribution[g] || 0;
                  if (count === 0) return null;
                  return (
                    <span key={g} className={`text-xs font-bold px-2 py-1 rounded border ${gradeBadgeLight(g)}`}>
                      {g}: {count}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                {summary.total_litigations > 0 && (
                  <span className="text-red-600 font-medium">⚖️ {summary.total_litigations} HPD Lawsuit{summary.total_litigations > 1 ? "s" : ""}{summary.open_litigations > 0 ? ` (${summary.open_litigations} open)` : ""}</span>
                )}
                {summary.expired_tcos > 0 && (
                  <span className="text-red-600 font-medium">⚠ {summary.expired_tcos} Expired TCO{summary.expired_tcos > 1 ? "s" : ""}</span>
                )}
                {summary.unsigned_jobs > 0 && (
                  <span className="text-orange-600 font-medium">{summary.unsigned_jobs} Uninspected Work</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Properties Map</h2>
          <OwnerMap buildings={filtered} />
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Grade:</span>
            {GRADES.map((g) => (
              <span key={g} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: g === "A" ? "#22c55e" : g === "B" ? "#3b82f6" : g === "C" ? "#eab308" : g === "D" ? "#f97316" : "#ef4444" }} />
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Filters & Building List */}
        <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Buildings ({filtered.length})</h2>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              placeholder="Filter by address..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
            {/* Grade pills */}
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${gradeFilter === g ? gradeBadgeLight(g) + " ring-2 ring-offset-1 ring-blue-400" : "bg-gray-50 dark:bg-[#0f1117] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 "}`}
              >
                {g}
              </button>
            ))}
            {/* Borough pills */}
            {summary?.boroughs.map((boro) => (
              <button
                key={boro}
                onClick={() => setBoroughFilter(boroughFilter === boro ? null : boro)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${boroughFilter === boro ? "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-offset-1 ring-blue-400" : "bg-gray-50 dark:bg-[#0f1117] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 "}`}
              >
                {boro}
              </button>
            ))}
            {(gradeFilter || boroughFilter || addressSearch) && (
              <button onClick={() => { setGradeFilter(null); setBoroughFilter(null); setAddressSearch(""); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <SortHeader label="Address" field="address" />
                  <SortHeader label="Borough" field="borough" />
                  <SortHeader label="Grade" field="score_grade" />
                  <SortHeader label="Open C" field="open_class_c" />
                  <SortHeader label="HPD Viol." field="total_hpd_violations" />
                  <SortHeader label="ECB Penalties" field="ecb_penalties" />
                  <SortHeader label="C of O" field="co_status" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.bin}
                    onClick={() => router.push(`/building/${b.bin}`)}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-2 font-medium text-gray-900 dark:text-gray-100">{b.address}</td>
                    <td className="py-2.5 pr-2 text-gray-600 dark:text-gray-300">{b.borough}</td>
                    <td className="py-2.5 pr-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeColor(b.score_grade)}`}>{b.score_grade || "?"}</span>
                    </td>
                    <td className={`py-2.5 pr-2 ${(b.open_class_c || 0) > 0 ? "text-red-600 font-medium" : "text-gray-600 dark:text-gray-300"}`}>{b.open_class_c || 0}</td>
                    <td className="py-2.5 pr-2 text-gray-600 dark:text-gray-300">{b.total_hpd_violations || 0}</td>
                    <td className="py-2.5 pr-2 text-gray-600 dark:text-gray-300">{fmt$(b.ecb_penalties)}</td>
                    <td className="py-2.5 pr-2">
                      {b.tco_expired ? (
                        <span className="text-red-600 text-xs font-medium">Expired TCO</span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300 text-xs">{b.co_status || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">No buildings match your filters</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
