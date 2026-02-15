"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "../../components/SearchBar";
import DetailDrawer from "../../components/DetailDrawer";
import CodeGlossary from "../../components/CodeGlossary";
import { redactSlurs } from "../../utils/redact";
import BuildingSafetySummary from "../../components/BuildingSafetySummary";

function AISummary({ bin, existing, updatedAt }: { bin: string; existing?: string; updatedAt?: string }) {
  const [summary, setSummary] = useState(existing || "");
  const [date, setDate] = useState(updatedAt || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setSummary(existing || "");
    setDate(updatedAt || "");
    setExpanded(false);
  }, [existing, updatedAt]);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/building/${bin}/generate-summary`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setSummary(data.summary);
      setDate(data.generated_at);
    } catch (e: any) {
      setError(e.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  // Show ~40% of text by default, toggle to show full
  const truncateAt = Math.ceil(summary.length * 0.4);
  // Find a clean break point (end of sentence or paragraph) near the 40% mark
  const breakPoint = summary.lastIndexOf('. ', truncateAt);
  const cleanBreak = breakPoint > truncateAt * 0.5 ? breakPoint + 1 : truncateAt;
  const needsTruncation = summary.length > 300;
  const displayText = (!expanded && needsTruncation)
    ? summary.slice(0, cleanBreak).trim() + '…'
    : summary;

  return (
    <div className="mb-4">
      {summary ? (
        <div className="bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line" style={{ fontFamily: 'Inter, sans-serif' }}>
            {displayText}
          </p>
          {needsTruncation && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {date && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Summary generated {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 border-dashed rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 text-left"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating summary...
            </span>
          ) : (
            "✨ Generate Summary"
          )}
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface BuildingData {
  building: Record<string, any>;
  latitude: number | null;
  longitude: number | null;
  open_violations: any[];
  ecb_violations: any[];
  co_records: any[];
  permits: any[];
  bis_jobs: any[];
  unsigned_jobs: any[];
  contacts: any[];
  detailed_permits: any[];
}

function Collapsible({ title, subtitle, children, defaultOpen = false, badge, id, glossary }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode; id?: string; glossary?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (id && typeof window !== 'undefined' && window.location.hash === `#${id}`) {
      setOpen(true);
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [id]);
  return (
    <div ref={ref} id={id} className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none overflow-hidden">
      <div role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }} className="w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors text-left cursor-pointer">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-400 dark:text-gray-500 text-sm">{open ? "▼" : "▶"}</span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {badge}
          {subtitle && open && <p className="w-full text-xs text-gray-400 dark:text-gray-500 ml-7 -mt-1 text-left inline-flex items-center gap-1.5">{subtitle}{glossary && <span onClick={(e) => e.stopPropagation()}>{glossary}</span>}</p>}
        </div>
      </div>
      {open && <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-gray-100 dark:border-gray-800">{children}</div>}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold font-nunito ${color || "text-gray-900 dark:text-gray-100"}`}>{value ?? "—"}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function Callout({ label, value, warn, href }: { label: string; value: any; warn?: boolean; href?: string }) {
  const cls = `rounded-lg px-3 py-2 text-sm ${warn ? "bg-red-50 dark:bg-red-900/20 text-red-700" : "bg-gray-50 dark:bg-[#0f1117] text-gray-700 dark:text-gray-200"}`;
  const content = <><span className="font-medium">{label}:</span> {value ?? 0}</>;
  if (href) {
    return <Link href={href} className={`${cls} hover:brightness-90 dark:hover:brightness-125 transition-all cursor-pointer block`}>{content}</Link>;
  }
  return <div className={cls}>{content}</div>;
}

function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
      <div className="flex gap-2">
        <span className="text-blue-500 mt-0.5 shrink-0">⚖️</span>
        <div>{children}</div>
      </div>
    </div>
  );
}

function keywordCount(violations: any[], keywords: string[]) {
  return violations.filter((v) => {
    const desc = (v.novdescription || "").toLowerCase();
    return keywords.some((k) => desc.includes(k));
  }).length;
}

function keywordFilter(violations: any[], keywords: string[]) {
  return violations.filter((v) => {
    const desc = (v.novdescription || "").toLowerCase();
    return keywords.some((k) => desc.includes(k));
  });
}

function gradeColor(g: string | null) {
  if (!g) return "bg-gray-200 text-gray-700 dark:text-gray-200";
  if (g === "A") return "bg-green-500 text-white";
  if (g === "B") return "bg-blue-500 text-white";
  if (g === "C") return "bg-yellow-500 text-white";
  if (g === "D") return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function fmt$(v: any) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysOpen(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    return diff > 0 ? diff : null;
  } catch { return null; }
}

function formatDays(days: number | null) {
  if (days == null) return "—";
  if (days > 365) {
    const yrs = Math.floor(days / 365);
    return `${yrs}y ${days % 365}d`;
  }
  return `${days}d`;
}

function daysColor(days: number | null) {
  if (days == null) return "text-gray-400 dark:text-gray-500";
  if (days > 365) return "text-red-600 font-medium";
  if (days > 90) return "text-orange-500";
  return "text-gray-600 dark:text-gray-300";
}

function rowHighlight(v: any) {
  return "";
}

export default function BuildingPageWrapper() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div></div>}><BuildingPage /></Suspense>;
}

function BuildingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bin = params.bin as string;
  const apt = searchParams.get("apt") || "";
  const addrParam = searchParams.get("addr") || "";
  const fromOwner = searchParams.get("from_owner") || "";
  const networkNode = searchParams.get("network_node") || "";
  const ownerMode = searchParams.get("owner_mode") || "";
  
  // Build query string to preserve across navigation
  const qs = new URLSearchParams();
  if (apt) qs.set("apt", apt);
  if (addrParam) qs.set("addr", addrParam);
  const qsStr = qs.toString() ? `?${qs.toString()}` : "";
  const [data, setData] = useState<BuildingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail drawer state
  const [drawerType, setDrawerType] = useState<"hpd" | "ecb" | "permit" | "complaint" | "safety" | "litigation" | null>(null);
  const [drawerIdx, setDrawerIdx] = useState(-1);
  const [drawerData, setDrawerData] = useState<any[]>([]);
  const [mapTouched, setMapTouched] = useState(false);
  const [availableApts, setAvailableApts] = useState<string[]>([]);
  const [aptDropdownOpen, setAptDropdownOpen] = useState(false);
  const aptDropdownRef = useRef<HTMLDivElement>(null);
  const drawerItem = drawerIdx >= 0 ? drawerData[drawerIdx] : null;
  const closeDrawer = () => { setDrawerType(null); setDrawerIdx(-1); };
  const openDrawer = (type: "hpd" | "ecb" | "permit" | "complaint" | "safety" | "litigation", idx: number, items: any[]) => {
    setDrawerType(type); setDrawerIdx(idx); setDrawerData(items);
  };

  useEffect(() => {
    const url = apt ? `/api/building/${bin}?apt=${encodeURIComponent(apt)}` : `/api/building/${bin}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bin, apt]);

  // Fetch available apartments
  useEffect(() => {
    fetch(`/api/building/${bin}/apartments`)
      .then(r => r.json())
      .then(d => setAvailableApts(d.apartments || []))
      .catch(() => {});
  }, [bin]);

  // Close apt dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aptDropdownRef.current && !aptDropdownRef.current.contains(e.target as Node)) setAptDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">Building not found</div></div>;

  const b = data.building;
  const openViolations = data.open_violations || [];
  const ecb = data.ecb_violations || [];
  const permits = data.permits || [];
  const bisJobs = data.bis_jobs || [];
  const detailedPermits = (data as any).detailed_permits || [];
  const unsignedJobs = data.unsigned_jobs || [];
  const coRecords = data.co_records || [];
  const noInspectionCount = bisJobs.filter((j: any) => j.no_final_inspection).length;
  const criticalPermits = detailedPermits.filter((p: any) => p.risk_tier === 'critical');
  const highPermits = detailedPermits.filter((p: any) => p.risk_tier === 'high');
  const warningPermits = detailedPermits.filter((p: any) => p.risk_tier === 'warning');
  const lowPermits = detailedPermits.filter((p: any) => p.risk_tier === 'low');
  const clearPermits = detailedPermits.filter((p: any) => p.risk_tier === 'clear');
  const criticalByType: Record<string, number> = {};
  criticalPermits.forEach((p: any) => {
    const wt = p.work_type || "Other";
    criticalByType[wt] = (criticalByType[wt] || 0) + 1;
  });

  const openC = openViolations.filter((v) => v.class === "C" && v.violationstatus === "Open").length;
  const openB = openViolations.filter((v) => v.class === "B" && v.violationstatus === "Open").length;
  const openA = openViolations.filter((v) => v.class === "A" && v.violationstatus === "Open").length;
  const openOnly = openViolations.filter((v) => v.violationstatus === "Open");
  const leadPaint = keywordCount(openOnly, ["lead", "lead-based"]);
  const fireSafety = keywordCount(openOnly, ["fire", "smoke detector", "carbon monoxide", "sprinkler"]);
  const pest = keywordCount(openOnly, ["roach", "mice", "rat", "pest", "vermin", "bed bug"]);
  const mold = keywordCount(openOnly, ["mold", "mildew"]);
  const totalEcbPenalties = ecb.reduce((s, v) => s + (parseFloat(v.penality_imposed) || 0), 0);
  const lastInspection = openViolations.length > 0 ? openViolations[0].inspectiondate : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      {/* Header */}
      <header className="bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2 md:gap-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-bold text-lg sm:text-xl shrink-0 font-nunito leading-none py-2">Wocket</Link>
          <div className="flex-1 min-w-3" />
          <div className="w-full max-w-[220px] sm:max-w-sm min-w-0"><SearchBar /></div>
        </div>
      </header>

      {apt && data && (() => {
        const hpdMatches = (data.open_violations || []).filter((v: any) => v.is_unit_match);
        const ecbMatches = (data.ecb_violations || []).filter((v: any) => v.is_unit_match);
        const hpdOpen = hpdMatches.filter((v: any) => v.violationstatus === "Open");
        const hpdClassC = hpdOpen.filter((v: any) => v.class === "C");
        // Collect hazardous ECB violations with tags
        const hazardousEcb = ecbMatches.filter((v: any) => (v.tags || []).length > 0 && !['RESOLVE', 'DISMISS'].includes((v.ecb_violation_status || '').toUpperCase()));
        const allTags = new Map<string, { icon: string; label: string; violations: any[] }>();
        for (const v of hazardousEcb) {
          for (const t of v.tags || []) {
            if (!allTags.has(t.id)) allTags.set(t.id, { icon: t.icon, label: t.label, violations: [] });
            allTags.get(t.id)!.violations.push(v);
          }
        }
        // Priority order for hazard tags
        const hazardPriority = ["fire-stopping", "asbestos", "lead", "structural", "egress", "no-permit", "electrical", "plumbing", "mold", "pest", "facade", "elevator", "occupied"];
        const sortedTags = [...allTags.entries()].sort((a, b) => {
          const ai = hazardPriority.indexOf(a[0]);
          const bi = hazardPriority.indexOf(b[0]);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

        return (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <div className="max-w-5xl mx-auto px-3 md:px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-lg">Apt {apt}</span>
                  <span className="text-blue-700 dark:text-blue-300 text-sm">Apartment-specific violations are highlighted below</span>
                </div>
                <button onClick={() => router.push(`/building/${bin}`)} className="text-blue-400 hover:text-blue-600 text-lg font-bold leading-none" title="View full building">
                  ×
                </button>
              </div>
            </div>
            {/* Apartment Summary */}
            {(hpdMatches.length > 0 || ecbMatches.length > 0) && (
              <div className="bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-5xl mx-auto px-3 md:px-4 py-4">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Apartment {apt} — Summary</h2>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {hpdMatches.length > 0 && (
                      <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg px-3 py-2">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{hpdMatches.length}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">HPD Violations</div>
                      </div>
                    )}
                    {hpdOpen.length > 0 && (
                      <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg px-3 py-2">
                        <div className="text-lg font-bold text-red-600">{hpdOpen.length}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Open HPD</div>
                      </div>
                    )}
                    {hpdClassC.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                        <div className="text-lg font-bold text-red-600">{hpdClassC.length}</div>
                        <div className="text-[10px] text-red-500">Class C (Hazardous)</div>
                      </div>
                    )}
                    {ecbMatches.length > 0 && (
                      <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg px-3 py-2">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{ecbMatches.length}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">ECB Violations</div>
                      </div>
                    )}
                  </div>
                  {/* Hazard callouts with violation references */}
                  {sortedTags.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">⚠️ Hazard Flags</div>
                      {sortedTags.map(([tagId, { icon, label, violations }]) => (
                        <div key={tagId} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{icon}</span>
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{label}</span>
                          </div>
                          {violations.map((v: any) => (
                            <div key={v.ecb_violation_number} className="text-xs text-gray-700 dark:text-gray-300 ml-6 mb-0.5">
                              <span className="font-medium text-gray-900 dark:text-gray-100">ECB# {v.ecb_violation_number}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              <span>{v.issue_date?.slice(0, 10)}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              <span className={v.ecb_violation_status === "RESOLVE" ? "text-gray-500" : "text-red-600 font-medium"}>{v.ecb_violation_status}</span>
                              {v.penality_imposed && parseFloat(v.penality_imposed) > 0 && (
                                <span className="text-gray-400 ml-1">(${parseFloat(v.penality_imposed).toLocaleString()})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      <main className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-8 space-y-3 md:space-y-4">
        {/* Back to owner link (when navigated from network) */}
        {fromOwner && (
          <Link href={`/owner/${encodeURIComponent(fromOwner)}?${ownerMode ? `mode=${encodeURIComponent(ownerMode)}&` : ""}${networkNode ? `selected=${encodeURIComponent(networkNode)}` : ""}#network`} className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1">
            ← Back to {decodeURIComponent(fromOwner)}
          </Link>
        )}

        {/* Address title + grade */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none">
            {addrParam && addrParam !== b.address ? addrParam : b.address}
          </h1>
          <span className={`text-sm sm:text-base md:text-lg font-bold w-[26px] sm:w-[28px] md:w-[30px] aspect-square inline-flex items-center justify-center leading-none rounded-lg -translate-y-[4px] ${gradeColor(b.score_grade)}`}>{b.score_grade || "?"}</span>
          {/* Apartment dropdown */}
          {availableApts.length > 0 && (
            <div className="relative -translate-y-[4px]" ref={aptDropdownRef}>
              <button
                onClick={() => setAptDropdownOpen(!aptDropdownOpen)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${apt ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-[#1a1b2e] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"}`}
              >
                🏠 {apt ? `Apt ${apt}` : "Apartments"} <span className="text-[10px]">{aptDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {aptDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#1a1b2e] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 min-w-[200px] max-h-[300px] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Apartment-specific info available for:</div>
                  </div>
                  {apt && (
                    <button onClick={() => { router.push(`/building/${bin}`); setAptDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 font-medium">
                      ✕ Clear apartment filter
                    </button>
                  )}
                  {availableApts.map(a => (
                    <button
                      key={a}
                      onClick={() => { router.push(`/building/${bin}?apt=${encodeURIComponent(a)}`); setAptDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between ${apt === a ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      <span>Apt {a}</span>
                      {apt === a && <span className="text-blue-500 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link
            href={`/building/${bin}/report${qsStr}`}
            className="hidden sm:flex ml-auto text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-1.5 transition-colors items-center gap-1.5 leading-none -translate-y-[4px]"
          >
            📄 Generate Report
          </Link>
        </div>
        {(() => {
          const allAliases = (b.aliases || "").split("; ").map((a: string) => a.trim().replace(/\s+/g, ' ')).filter(Boolean);
          const mainAddr = addrParam && addrParam !== b.address ? addrParam : b.address;
          const otherAddresses = [b.address, ...allAliases].filter((a: string) => a && a !== mainAddr);
          const unique = [...new Set(otherAddresses)];
          return unique.length > 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 mb-2">Also known as: {unique.join(", ")}</div>
          ) : null;
        })()}
        <Link
          href={`/building/${bin}/report${qsStr}`}
          className="sm:hidden text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-1.5 transition-colors inline-flex items-center gap-1.5 mb-2"
        >
          📄 Generate Report
        </Link>

        {/* Building Safety Summary */}
        <BuildingSafetySummary data={data} />


        {/* AI Summary */}
        <AISummary bin={bin} existing={b.ai_summary} updatedAt={b.ai_summary_updated} />

        {/* Building Identity + Map grid — map matches identity card height */}
        <div className="grid md:grid-cols-[1fr_300px] gap-3 md:gap-4 items-stretch">
          {/* Building Identity */}
          <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Building Identity</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">BIN</span><div className="font-medium">{b.bin}</div></div>
              <div><span className="text-gray-500 dark:text-gray-400">BBL</span><div className="font-medium">{b.bbl || "—"}</div></div>
              <div><span className="text-gray-500 dark:text-gray-400">Block / Lot</span><div className="font-medium">{b.block || "—"} / {b.lot || "—"}</div></div>
              <div><span className="text-gray-500 dark:text-gray-400">Borough</span><div className="font-medium">{b.borough}</div></div>
              <div><span className="text-gray-500 dark:text-gray-400">ZIP</span><div className="font-medium">{b.zip || "—"}</div></div>
              <div><span className="text-gray-500 dark:text-gray-400">Owner</span><div className="font-medium">{b.owner_name ? <Link href={`/owner/${encodeURIComponent(b.owner_name)}?from=${bin}`} className="text-blue-600 hover:text-blue-800 hover:underline">{b.owner_name}</Link> : "—"}</div></div>
            </div>
          </div>

          {/* Map — stretches to match Building Identity height */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
            {data.latitude && data.longitude ? (
              <>
                <iframe
                  key={`map-${data.latitude}-${data.longitude}`}
                  id="building-map"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.longitude - 0.003},${data.latitude - 0.002},${data.longitude + 0.003},${data.latitude + 0.002}&layer=mapnik&marker=${data.latitude},${data.longitude}`}
                  className="w-full h-full border-0 min-h-[200px]"
                  loading="lazy"
                  title="Map of property location"
                />
                {mapTouched ? (
                  <button
                    onClick={() => {
                      const iframe = document.getElementById('building-map') as HTMLIFrameElement;
                      if (iframe) { const src = iframe.src; iframe.src = ''; iframe.src = src; }
                      setMapTouched(false);
                    }}
                    className="absolute bottom-[10px] left-[10px] bg-white border-2 border-gray-400/60 rounded-sm w-[30px] h-[30px] flex items-center justify-center text-base text-gray-700 hover:bg-gray-100 shadow-none z-10 cursor-pointer leading-none"
                    title="Reset map view"
                  >
                    ⟲
                  </button>
                ) : (
                  <div
                    className="absolute inset-0 z-[5]"
                    onPointerDown={() => setMapTouched(true)}
                    style={{ pointerEvents: 'auto', background: 'transparent' }}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm text-center p-4 min-h-[200px]">Map not available</div>
            )}
          </div>
        </div>


        {/* Renter's Profile */}
        <Collapsible title="Apartment Hunter's Guide" defaultOpen={true} badge={<span className="text-xs text-gray-500 dark:text-gray-400">What renters should know before signing a lease</span>}>
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Construction */}
              {(() => {
                const allP = [...bisJobs.map((j: any) => ({...j, source: 'BIS'})), ...detailedPermits];
                const recent = allP.filter((j: any) => {
                  if (j.signed_off || j.risk_tier === 'clear') return false;
                  const desc = (j.job_description || '').toUpperCase();
                  if (desc.includes('NO WORK')) return false;
                  const d = j.latest_action_date || j.issued_date;
                  if (!d) return false;
                  return (Date.now() - new Date(d).getTime()) / 86400000 < 730;
                });
                const wt = [...new Set(recent.map((j: any) => j.work_type).filter(Boolean))];
                const hasSt = wt.some(w => ['General Construction', 'Structural', 'Foundation'].includes(w));
                const cnt = recent.length;
                const ed = recent.map((j: any) => j.latest_action_date || j.issued_date).filter(Boolean).sort()[0];
                const dm = ed ? Math.round((Date.now() - new Date(ed as string).getTime()) / (30 * 86400000)) : 0;
                const ds = dm >= 24 ? `${Math.floor(dm/12)}+ years` : dm >= 1 ? `${dm} months` : 'recent';
                let level = 'No active construction';
                if (cnt > 10 || hasSt) level = `Heavy Construction · ${ds}`;
                else if (cnt > 3 || wt.length > 1) level = `Moderate Construction · ${ds}`;
                else if (cnt > 0) level = `Minor Work · ${ds}`;
                return (
                  <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-lg">🏗️</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Construction</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{level}</div></div>
                  </div>
                );
              })()}
              {/* Pest */}
              {(() => {
                const items = keywordFilter(openViolations, ["roach", "mice", "rat", "pest", "vermin", "bed bug"]);
                return (
                  <div onClick={() => items.length > 0 && openDrawer("hpd", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">🪳</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Pest History</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} violations</div></div>
                  </div>
                );
              })()}
              {/* Lead */}
              {(() => {
                const items = keywordFilter(openViolations, ["lead", "lead-based"]);
                const leadO = keywordFilter(openOnly, ["lead", "lead-based"]).length;
                return (
                  <div onClick={() => items.length > 0 && openDrawer("hpd", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">🧪</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Lead Paint</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} violations{leadO > 0 ? <span className="text-red-600 ml-1">({leadO} open)</span> : ""}</div></div>
                  </div>
                );
              })()}
              {/* Fire Safety */}
              {(() => {
                const items = keywordFilter(openOnly, ["fire", "smoke detector", "carbon monoxide", "sprinkler"]);
                return (
                  <div onClick={() => items.length > 0 && openDrawer("hpd", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">🔥</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Fire Safety</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} open</div></div>
                  </div>
                );
              })()}
              {/* Mold */}
              {(() => {
                const items = keywordFilter(openOnly, ["mold", "mildew"]);
                return (
                  <div onClick={() => items.length > 0 && openDrawer("hpd", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">🌫️</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Mold</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} open</div></div>
                  </div>
                );
              })()}
              {/* Elevator */}
              {(() => {
                const items = ((data as any).safety_violations || []).filter((v: any) => (v.device_type || "").toLowerCase().includes("elev"));
                return (
                  <div onClick={() => items.length > 0 && openDrawer("safety", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">⚡</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Elevator</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} violations</div></div>
                  </div>
                );
              })()}
              {/* Landlord */}
              {(() => {
                const items = (data as any).litigations || [];
                const openLits = items.filter((l: any) => l.casestatus === "OPEN");
                return (
                  <div onClick={() => items.length > 0 && openDrawer("litigation", 0, items)} className={`bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 ${items.length > 0 ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""}`}>
                    <span className="text-lg">👤</span>
                    <div><div className="text-xs text-gray-500 dark:text-gray-400">Landlord</div><div className="text-sm font-medium text-gray-900 dark:text-gray-100">{items.length} litigation{items.length !== 1 ? "s" : ""}{openLits.length > 0 ? <span className="text-red-600 ml-1">· {openLits.length} active</span> : ""}</div></div>
                  </div>
                );
              })()}
            </div>

            {/* Apartment-specific subsection */}
            {apt && (() => {
              const aptViols = openViolations.filter((v: any) => v.is_unit_match);
              if (aptViols.length === 0) return null;
              const aptOpen = aptViols.filter((v: any) => v.violationstatus === "Open");
              const years = Math.max(1, Math.round((Date.now() - new Date(aptViols[aptViols.length - 1]?.inspectiondate || Date.now()).getTime()) / (365 * 86400000)));
              return (
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Apartment {apt}</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    This apartment has had <strong>{aptViols.length} violation{aptViols.length !== 1 ? "s" : ""}</strong>{years > 0 ? ` in ${years} year${years !== 1 ? "s" : ""}` : ""} ({aptOpen.length} currently open).
                  </p>
                </div>
              );
            })()}

            {/* Generate Renter's Report button */}
            <div className="mt-4 flex flex-col gap-1.5">
              <Link
                href={`/building/${bin}/renters-report${qsStr}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors w-fit"
              >
                📋 Generate Apartment Report
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">A printable safety snapshot covering open violations, construction activity, complaint history, and landlord track record — take it to your apartment viewing or lease negotiation.</p>
            </div>
          </div>
        </Collapsible>

        {/* Certificate of Occupancy */}
        <Collapsible
          title="Certificate of Occupancy"
          defaultOpen={b.tco_expired}
          badge={
            b.tco_expired
              ? <Link href="/explore/expired-tcos" className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium hover:bg-red-200 transition-colors">Expired TCO</Link>
              : b.co_status === "TCO"
                ? <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">TCO</span>
                : b.co_status === "Final"
                  ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Final C of O</span>
                  : <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">{b.co_status || "No record on file"}</span>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-4">
            <div><span className="text-gray-500 dark:text-gray-400">C of O Status</span><div className={`font-medium ${b.tco_expired ? "text-red-600" : b.co_status ? "text-green-600" : "text-gray-500 dark:text-gray-400"}`}>{b.co_status || "No record on file"}</div></div>
            {b.co_status === "TCO" && (data as any).first_tco_date && <div><span className="text-gray-500 dark:text-gray-400">First TCO Issued</span><div className="font-medium">{formatDate((data as any).first_tco_date)}</div></div>}
            {b.co_status === "TCO" && (data as any).latest_tco_date && <div><span className="text-gray-500 dark:text-gray-400">Latest TCO Renewal</span><div className="font-medium">{formatDate((data as any).latest_tco_date)}</div></div>}
            {b.co_status === "TCO" && (data as any).first_tco_date && (() => {
              const first = new Date((data as any).first_tco_date);
              const years = Math.floor((Date.now() - first.getTime()) / (365.25 * 86400000));
              const months = Math.floor(((Date.now() - first.getTime()) / (30.44 * 86400000)) % 12);
              return years > 0 ? (
                <div><span className="text-gray-500 dark:text-gray-400">TCO Duration</span><div className={`font-medium ${years >= 2 ? "text-red-600" : ""}`}>{years}y {months}m</div></div>
              ) : null;
            })()}
            <div><span className="text-gray-500 dark:text-gray-400">Unsigned A1/NB Jobs</span><div className={`font-medium ${unsignedJobs.length > 0 ? "text-orange-600" : ""}`}>{unsignedJobs.length}</div></div>
          </div>
          {coRecords.length > 0 && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">{coRecords.length} C of O record(s) on file</div>
          )}
          {b.tco_expired && (
            <LegalNote>
              <strong>This building's Temporary Certificate of Occupancy has expired.</strong> Under NYC Multiple Dwelling Law § 301, it is <strong>illegal to occupy a building without a valid Certificate of Occupancy</strong>. Tenants in buildings with expired TCOs may have grounds to withhold rent, and landlords cannot legally collect rent for an illegally occupied building. See <em>Kozak v. Kushner Village LLC</em> (App. Div. 1st Dept., 2024).
            </LegalNote>
          )}
          {!b.tco_expired && b.co_status === "TCO" && (
            <LegalNote>
              This building operates under a <strong>Temporary Certificate of Occupancy</strong>, which must be renewed periodically. If the TCO lapses, the building becomes illegally occupied under MDL § 301. Tenants should verify TCO renewal dates with the DOB.
            </LegalNote>
          )}
          {unsignedJobs.length > 0 && !b.tco_expired && (
            <LegalNote>
              This building has <strong>{unsignedJobs.length} major construction job(s) without final signoff</strong>. Unsigned Alteration Type 1 or New Building jobs may indicate construction was never completed to code, which can affect the validity of the Certificate of Occupancy.
            </LegalNote>
          )}
        </Collapsible>

        {/* HPD Violations */}
        <Collapsible
          title="HPD Violations"
          subtitle="Housing conditions found by HPD inspectors — heat, lead, pests, mold, fire safety, and more"
          defaultOpen={openC > 0}
          badge={openC > 0 ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">{openC} Class C</span> : undefined}
          glossary={<CodeGlossary sections={[
            { title: "Violation Classes", entries: [
              { code: "C", label: "Immediately hazardous — must be corrected within 24 hours", color: "bg-red-100 text-red-700" },
              { code: "B", label: "Hazardous — must be corrected within 30 days", color: "bg-orange-100 text-orange-700" },
              { code: "A", label: "Non-hazardous — must be corrected within 90 days", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" },
            ]},
          ]} />}
        >
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Class C — Immediately Hazardous" value={openC} color="text-red-600" />
              <Stat label="Class B — Hazardous" value={openB} color="text-orange-500" />
              <Stat label="Class A — Non-Hazardous" value={openA} />
              <Stat label="Total HPD Violations" value={b.total_hpd_violations} />
              <Stat label="Last Inspection" value={formatDate(lastInspection)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Callout label="Lead Paint (open)" value={leadPaint} warn={leadPaint > 0} href={leadPaint > 0 ? `/building/${bin}/violations?search=lead&status=Open&sort=severity${qsStr ? '&' + qsStr.slice(1) : ''}` : undefined} />
              <Callout label="Fire Safety (open)" value={fireSafety} warn={fireSafety > 0} href={fireSafety > 0 ? `/building/${bin}/violations?search=fire&status=Open&sort=severity${qsStr ? '&' + qsStr.slice(1) : ''}` : undefined} />
              <Callout label="Pest (open)" value={pest} warn={pest > 0} href={pest > 0 ? `/building/${bin}/violations?search=pest&status=Open&sort=severity${qsStr ? '&' + qsStr.slice(1) : ''}` : undefined} />
              <Callout label="Mold (open)" value={mold} warn={mold > 0} href={mold > 0 ? `/building/${bin}/violations?search=mold&status=Open&sort=severity${qsStr ? '&' + qsStr.slice(1) : ''}` : undefined} />
            </div>
          </div>
          {openViolations.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2 pr-2">ID</th><th className="pb-2 pr-2">Class</th><th className="pb-2 pr-2">Date</th><th className="pb-2 pr-2">Open</th><th className="pb-2 pr-2">Status</th><th className="pb-2">Description</th>
                </tr></thead>
                <tbody>
                  {openViolations.slice(0, 10).map((v, i) => {
                    const days = v.currentstatus === 'Open' || v.violationstatus === 'Open' ? daysOpen(v.inspectiondate) : null;
                    return (
                    <tr key={i} onClick={() => openDrawer("hpd", i, openViolations.slice(0, 10))} className={`border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors ${rowHighlight(v)}`}>
                      <td className="py-2 pr-2 text-xs text-gray-500 dark:text-gray-400">{v.violationid}</td>
                      <td className="py-2 pr-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v.class === "C" ? "bg-red-100 text-red-700" : v.class === "B" ? "bg-orange-100 text-orange-700" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>{v.class}</span></td>
                      <td className="py-2 pr-2 text-xs">{formatDate(v.inspectiondate)}</td>
                      <td className={`py-2 pr-2 text-xs ${daysColor(days)}`}>{formatDays(days)}</td>
                      <td className="py-2 pr-2 text-xs">{v.currentstatus}</td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs relative overflow-visible">
                        <span className="block truncate">{v.novdescription}</span>
                        {(v.is_unit_match || v.is_floor_match) && <span className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${v.is_unit_match ? "bg-blue-600" : "bg-blue-400"}`}>Apt {v.apartment || apt}</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {openViolations.length > 10 && <Link href={`/building/${bin}/violations${qsStr}`} className="mt-2 block text-sm text-blue-600 hover:text-blue-800 font-medium">View all {b.total_hpd_violations} violations →</Link>}
            </div>
          )}
          {openC > 0 && (
            <LegalNote>
              This building has <strong>{openC} open Class C ("Immediately Hazardous") violation{openC > 1 ? "s" : ""}</strong>. Under NYC Housing Maintenance Code § 27-2115, landlords must correct Class C violations within <strong>24 hours</strong> of being served notice. Failure to do so can result in civil penalties up to $250/day per violation. Tenants can call <strong>311</strong> or file complaints at <a href="https://portal.311.nyc.gov" target="_blank" rel="noopener noreferrer" className="underline font-medium">portal.311.nyc.gov</a>.
            </LegalNote>
          )}
          {leadPaint > 0 && (
            <LegalNote>
              <strong>Lead paint violations are present.</strong> Under NYC Local Law 1 (2004), landlords of pre-1960 buildings must inspect for and remediate lead-based paint hazards annually in apartments with children under 6. Failure to remediate lead hazards is a <strong>Class C (Immediately Hazardous) violation</strong>. Tenants with children should contact HPD at <strong>311</strong> immediately.
            </LegalNote>
          )}
          {fireSafety > 0 && (
            <LegalNote>
              <strong>Open fire safety violations are present.</strong> Fire-stopping, sprinkler, and smoke detector deficiencies directly endanger lives. Under NYC Admin Code § 28-201.1, the building owner is required to maintain all fire protection systems. Tenants should report fire safety concerns to both HPD (311) and <strong>FDNY</strong>.
            </LegalNote>
          )}
        </Collapsible>

        {/* ECB Violations */}
        <Collapsible title="DOB/ECB Violations" subtitle="Building code violations issued by the Dept. of Buildings — illegal work, no permits, stop work orders" badge={ecb.length > 0 ? <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">{ecb.length}</span> : undefined}
          glossary={<CodeGlossary sections={[
            { title: "ECB Violation Status", entries: [
              { code: "DEFAULT", label: "Respondent failed to appear — default penalty imposed", color: "text-red-500" },
              { code: "RESOLVE", label: "Violation resolved or penalty paid" },
              { code: "PENALIZE", label: "Penalty assessed after hearing" },
              { code: "DISMISS", label: "Violation dismissed at hearing" },
            ]},
            { title: "Severity Classes", entries: [
              { code: "Immediately Hazardous", label: "Serious and immediate threat to life or safety — e.g. gas leaks, structural failure, missing fire protection. Requires urgent correction.", color: "text-red-500" },
              { code: "Hazardous", label: "Dangerous condition that could cause harm — e.g. illegal occupancy, blocked egress, faulty electrical. Must be corrected promptly." },
              { code: "Non-Hazardous", label: "Minor code violation with no immediate danger — e.g. missing signage, paperwork issues, minor maintenance." },
              { code: "Unknown", label: "Severity not yet classified by ECB" },
            ]},
          ]} />}
        >
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Total ECB Violations" value={b.total_ecb_violations} />
              <Stat label="Total ECB Penalties" value={fmt$(totalEcbPenalties)} color={totalEcbPenalties > 0 ? "text-red-600" : undefined} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Callout label="Stop Work Orders" value={ecb.filter(v => (v.violation_description||"").toLowerCase().includes("stop work")).length} warn />
              <Callout label="Unlicensed Contractor" value={ecb.filter(v => (v.violation_description||"").toLowerCase().includes("unlicensed")).length} warn />
            </div>
          </div>
          {ecb.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2 pr-2">Severity</th><th className="pb-2 pr-2">Issue Date</th><th className="pb-2 pr-2">Status</th><th className="pb-2 pr-2">Type</th><th className="pb-2">Penalty</th>
                </tr></thead>
                <tbody>
                  {ecb.slice(0, 10).map((v, i) => (
                    <tr key={i} onClick={() => openDrawer("ecb", i, ecb.slice(0, 10))} className={`border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors ${rowHighlight(v)}`}>
                      <td className="py-2 pr-2 text-xs">{v.severity || "—"}</td>
                      <td className="py-2 pr-2 text-xs">{formatDate(v.issue_date)}</td>
                      <td className="py-2 pr-2 text-xs">{v.ecb_violation_status}</td>
                      <td className="py-2 pr-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs relative">
                        <span className="truncate block pr-14">{v.violation_description}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(v.tags || []).map((t: any) => (
                            <span key={t.id} className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{t.icon} {t.label}</span>
                          ))}
                          {!apt && (v.extracted_apartments || []).length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">🏠 {(v.extracted_apartments || []).join(", ")}</span>
                          )}
                        </div>
                        {v.is_unit_match && <span className="absolute right-1 top-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Apt {apt}</span>}
                      </td>
                      <td className="py-2 text-xs">{fmt$(v.penality_imposed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ecb.length > 10 && <Link href={`/building/${bin}/ecb${qsStr}`} className="mt-2 block text-sm text-blue-600 hover:text-blue-800 font-medium">View all {b.total_ecb_violations} ECB violations →</Link>}
            </div>
          )}
          {totalEcbPenalties > 10000 && (
            <LegalNote>
              This building has accumulated <strong>{fmt$(totalEcbPenalties)} in ECB penalties</strong>. Under NYC Admin Code § 28-202.1, unpaid ECB penalties accrue as liens against the property. A pattern of DOB violations may indicate the owner is neglecting code compliance — tenants can cite this history in Housing Court proceedings.
            </LegalNote>
          )}
          {ecb.filter(v => (v.violation_description||"").toLowerCase().includes("stop work")).length > 0 && (
            <LegalNote>
              <strong>Stop Work Orders have been issued at this building.</strong> Under NYC Admin Code § 28-207.2, all construction must cease when a Stop Work Order is in effect. Continuing work in violation of a SWO is a criminal offense. Tenants should report ongoing construction during a SWO to 311.
            </LegalNote>
          )}
        </Collapsible>

        {/* DOB Safety Violations */}
        {(() => {
          const safety = (data as any).safety_violations || [];
          const totalSafety = (data as any).total_safety_violations || 0;
          const activeSafety = safety.filter((v: any) => v.violation_status === 'Active');
          if (totalSafety === 0) return null;
          return (
          <Collapsible id="safety-violations" title="DOB Safety Violations" subtitle="Elevator, boiler, façade, and other safety device violations issued by DOB" badge={
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">{totalSafety}{activeSafety.length > 0 ? ` (${activeSafety.length} active)` : ''}</span>
          }
          glossary={<CodeGlossary sections={[
            { title: "Device Types", entries: [
              { code: "ELEV", label: "Elevator — passenger or freight elevator systems" },
              { code: "BOIL", label: "Boiler — heating boiler equipment" },
              { code: "FACA", label: "Façade — exterior wall inspection (Local Law 11)" },
              { code: "SPKR", label: "Sprinkler — fire sprinkler systems" },
              { code: "STPK", label: "Standpipe — fire standpipe systems" },
              { code: "COOL", label: "Cooling tower — Legionella risk equipment" },
            ]},
            { title: "Violation Status", entries: [
              { code: "Active", label: "Violation is currently open and unresolved", color: "text-red-500" },
              { code: "Resolve", label: "Violation has been resolved or corrected" },
              { code: "Dismiss", label: "Violation was dismissed" },
            ]},
          ]} />}
          >
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                {activeSafety.length > 0 && (
                  <Callout label="Active Safety Violations" value={activeSafety.length} warn />
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                    <th className="pb-2 pr-2">Date</th><th className="pb-2 pr-2">Type</th><th className="pb-2 pr-2">Device</th><th className="pb-2 pr-2">Status</th><th className="pb-2">Description</th>
                  </tr></thead>
                  <tbody>
                    {safety.slice(0, 10).map((v: any, i: number) => (
                      <tr key={i} onClick={() => openDrawer("safety" as any, i, safety.slice(0, 10))} className="border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors">
                        <td className="py-2 pr-2 text-xs">{v.violation_issue_date ? v.violation_issue_date.slice(0, 10) : "—"}</td>
                        <td className="py-2 pr-2 text-xs">{v.device_type || "—"}</td>
                        <td className="py-2 pr-2 text-xs text-gray-500 dark:text-gray-400">{v.device_number || "—"}</td>
                        <td className="py-2 pr-2 text-xs">
                          <span className={v.violation_status === 'Active' ? 'text-red-600 font-medium' : 'text-gray-500'}>{v.violation_status}</span>
                        </td>
                        <td className="py-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">{v.violation_remarks || v.violation_type || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Collapsible>
          );
        })()}

        {/* Permits & Construction */}
        <Collapsible 
          title="Permits & Construction"
          subtitle="Active and expired construction permits — plumbing, electrical, structural, and more"
          defaultOpen={criticalPermits.length > 0}
          glossary={<CodeGlossary sections={[
            { title: "Risk Tiers", entries: [
              { code: "Critical", label: "High-risk work (plumbing, gas, sprinklers, structural) — uninspected 2+ years", color: "text-red-600" },
              { code: "High", label: "High-risk work uninspected < 2 years, or any work uninspected 5+ years", color: "text-red-400" },
              { code: "Warning", label: "Non-high-risk work uninspected 1–5 years", color: "text-orange-500" },
              { code: "Low", label: "Uninspected less than 1 year", color: "text-yellow-500" },
              { code: "Clear", label: "Signed off — final inspection completed", color: "text-green-500" },
              { code: "None", label: "No work filings, active permits, or not yet expired", color: "text-gray-400" },
            ]},
            { title: "Job Types", entries: [
              { code: "A1", label: "Alteration Type 1 — major structural change affecting use, egress, or occupancy" },
              { code: "A2", label: "Alteration Type 2 — multiple work types, no change in use/egress/occupancy" },
              { code: "A3", label: "Alteration Type 3 — single work type (e.g., plumbing only)" },
              { code: "NB", label: "New Building — complete new construction" },
              { code: "DM", label: "Demolition" },
            ]},
          ]} />}
          badge={<>
            {criticalPermits.length > 0 && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium"><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" />{criticalPermits.length} Critical</span>}
            {highPermits.length > 0 && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium"><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />{highPermits.length} High</span>}
            {warningPermits.length > 0 && <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium"><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />{warningPermits.length} Warning</span>}
            {lowPermits.length > 0 && <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium"><span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500" />{lowPermits.length} Low</span>}
          </>}
        >
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Critical" value={criticalPermits.length} color={criticalPermits.length > 0 ? "text-red-600" : undefined} />
              <Stat label="High" value={highPermits.length} color={highPermits.length > 0 ? "text-red-400" : undefined} />
              <Stat label="Warning / Low" value={warningPermits.length + lowPermits.length} color={warningPermits.length + lowPermits.length > 0 ? "text-orange-500" : undefined} />
              {(() => {
                // Construction status - computed inline
                const allPermitsForStatus = [...bisJobs.map((j: any) => ({...j, source: 'BIS'})), ...detailedPermits];
                const recentActive = allPermitsForStatus.filter((j: any) => {
                  if (j.signed_off || j.risk_tier === 'clear') return false;
                  const desc = (j.job_description || '').toUpperCase();
                  if (desc.includes('NO WORK')) return false;
                  const d = j.latest_action_date || j.issued_date;
                  if (!d) return false;
                  return (Date.now() - new Date(d).getTime()) / 86400000 < 730;
                });
                const workTypesCS = [...new Set(recentActive.map((j: any) => j.work_type).filter(Boolean))];
                const hasStructuralCS = workTypesCS.some(w => ['General Construction', 'Structural', 'Foundation'].includes(w));
                const countCS = recentActive.length;
                const earliestDate = recentActive.map((j: any) => j.latest_action_date || j.issued_date).filter(Boolean).sort()[0];
                const durationMonths = earliestDate ? Math.round((Date.now() - new Date(earliestDate as string).getTime()) / (30 * 86400000)) : 0;
                const durationStr = durationMonths >= 24 ? `${Math.floor(durationMonths/12)}+ years` : durationMonths >= 1 ? `${durationMonths} months` : 'recent';

                let level = ''; let color = '';
                if (countCS > 10 || hasStructuralCS) { level = 'Heavy construction'; color = 'text-red-600'; }
                else if (countCS > 3 || workTypesCS.length > 1) { level = 'Moderate construction'; color = 'text-orange-500'; }
                else if (countCS > 0) { level = 'Minor work'; color = 'text-yellow-600'; }

                return countCS > 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className={`text-lg font-semibold ${color}`}>🏗️ {level}</div>
                    <div className="text-xs text-gray-500 mt-1">{durationStr} · {workTypesCS.join(', ') || 'Unknown'}</div>
                  </div>
                ) : (
                  <Stat label="Construction" value="None" />
                );
              })()}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(criticalByType).map(([wt, count]) => (
                <Callout key={wt} label={`${wt} — Expired, Never Inspected`} value={count} warn />
              ))}
              {noInspectionCount > 0 && <Callout label="BIS Permits — No Final Inspection" value={noInspectionCount} warn />}
            </div>
          </div>
          {(bisJobs.length > 0 || detailedPermits.length > 0) && (() => {
            const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, warning: 2, low: 3, active: 4, none: 5, clear: 6 };
            const riskDisc = (tier: string) => {
              if (tier === 'critical') return <span className="inline-block w-2 h-2 rounded-full bg-red-600 shrink-0" />;
              if (tier === 'high') return <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />;
              if (tier === 'warning') return <span className="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" />;
              if (tier === 'low') return <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 shrink-0" />;
              if (tier === 'clear') return <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />;
              return <span className="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0" />;
            };
            // Merge BIS jobs and detailed permits, dedup by job number, prefer detailed permits
            const byJob = new Map<string, any>();
            bisJobs.forEach((j: any) => byJob.set(j.job, { ...j, source: 'BIS' }));
            detailedPermits.forEach((p: any) => {
              const key = p.job_filing_number;
              const existing = byJob.get(key);
              byJob.set(key, { 
                job: key, 
                job_type: existing?.job_type || '', 
                job_status_descrp: existing?.job_status_descrp || p.permit_status || '',
                latest_action_date: existing?.latest_action_date || p.issued_date,
                work_type: p.work_type, 
                risk_tier: p.risk_tier || existing?.risk_tier || 'none',
                signed_off: p.signed_off ?? existing?.signed_off,
                no_final_inspection: existing?.no_final_inspection || (p.signed_off === false && (p.risk_tier === 'critical' || p.risk_tier === 'warning')),
                is_unit_match: existing?.is_unit_match || false,
              });
            });
            const allJobs = Array.from(byJob.values());
            // Sort by inspection status: no final inspection first, then pending, then signed off
            const inspectOrder = (j: any) => {
              if (j.no_final_inspection && !j.signed_off) return 0;
              if (!j.signed_off && (j.risk_tier === 'critical' || j.risk_tier === 'high')) return 1;
              if (!j.signed_off) return 2;
              return 3;
            };
            const sorted = allJobs.sort((a, b) => inspectOrder(a) - inspectOrder(b) || (RISK_ORDER[a.risk_tier] ?? 3) - (RISK_ORDER[b.risk_tier] ?? 3));
            return (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2 pr-1 w-6"></th><th className="pb-2 pr-2">Job #</th><th className="pb-2 pr-2">Type</th><th className="pb-2 pr-2">Work</th><th className="pb-2 pr-2">Status</th><th className="pb-2 pr-2">Date</th><th className="pb-2">Inspection</th>
                </tr></thead>
                <tbody>
                  {sorted.slice(0, 10).map((j: any, i: number) => (
                    <tr key={i} onClick={() => openDrawer("permit", i, sorted.slice(0, 10))} className={`border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors ${rowHighlight(j)}`}>
                      <td className="py-2 pr-1">{riskDisc(j.risk_tier || 'none')}</td>
                      <td className="py-2 pr-2 text-xs text-gray-500 dark:text-gray-400">{j.job}</td>
                      <td className="py-2 pr-2 text-xs">{j.job_type}</td>
                      <td className="py-2 pr-2 text-xs text-gray-600 dark:text-gray-300">{j.work_type || "—"}</td>
                      <td className="py-2 pr-2 text-xs">{j.job_status_descrp}</td>
                      <td className="py-2 pr-2 text-xs">{formatDate(j.latest_action_date)}</td>
                      <td className="py-2 text-xs">
                        {j.signed_off
                          ? <span className="text-green-600">✓ Signed off</span>
                          : (() => {
                              const days = daysOpen(j.latest_action_date);
                              const daysStr = days ? ` · ${formatDays(days)}` : '';
                              return j.no_final_inspection 
                                ? <span className={`font-medium ${daysColor(days)}`}>⚠ No Final{daysStr}</span>
                                : j.risk_tier === 'active'
                                  ? <span className="text-yellow-600">Pending{daysStr}</span>
                                  : <span className="text-gray-400 dark:text-gray-500">—</span>;
                            })()
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link href={`/building/${bin}/permits${qsStr}`} className="mt-2 block text-sm text-blue-600 hover:text-blue-800 font-medium">View all permits & jobs →</Link>
            </div>
            );
          })()}
          {criticalPermits.length > 0 && (
            <LegalNote>
              This building has <strong>{criticalPermits.length} high-risk expired permit{criticalPermits.length > 1 ? "s" : ""} that {criticalPermits.length > 1 ? "were" : "was"} never inspected</strong> — including work on plumbing, gas, sprinklers, or structural systems. Under NYC Admin Code § 28-116.1, permitted work must pass a final inspection before occupancy. Uninspected plumbing and gas work poses serious safety risks. Report concerns to <strong>311</strong> or the <strong>DOB</strong>.
            </LegalNote>
          )}
        </Collapsible>

        {/* DOB Complaints */}
        {(() => {
          const complaints = (data as any).complaints || [];
          const totalComplaints = (data as any).total_complaints || 0;
          const openComplaints = complaints.filter((c: any) => c.status === 'ACTIVE');
          return (
          <Collapsible title="DOB Complaints" subtitle="Reports filed by tenants or the public about construction, unsafe conditions, or illegal building work (separate from HPD housing complaints)" badge={
            totalComplaints > 0 ? <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">{totalComplaints}</span> : undefined
          }
          glossary={<CodeGlossary sections={[
            { title: "Complaint Status", entries: [
              { code: "ACTIVE", label: "Complaint is open and under investigation", color: "text-red-500" },
              { code: "CLOSED", label: "Investigation complete or complaint resolved" },
            ]},
            { title: "Common Categories", entries: [
              { code: "05", label: "Illegal conversion of building use" },
              { code: "06", label: "Construction — illegal or non-permitted work" },
              { code: "12", label: "Illegal/unsafe occupancy" },
              { code: "31", label: "Certificate of Occupancy — missing or non-compliant" },
              { code: "45", label: "Failure to maintain" },
              { code: "49", label: "Scaffolding / sidewalk shed" },
              { code: "83", label: "Stop work order violation" },
            ]},
          ]} />}
          >
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                {openComplaints.length > 0 && (
                  <Callout label="Active Complaints" value={openComplaints.length} warn />
                )}
              </div>
              {complaints.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2 pr-2">Date</th><th className="pb-2 pr-2">Category</th><th className="pb-2 pr-2">Status</th><th className="pb-2 pr-2">Disposition</th><th className="pb-2">Inspected</th>
                    </tr></thead>
                    <tbody>
                      {complaints.slice(0, 10).map((c: any, i: number) => (
                        <tr key={i} onClick={() => openDrawer("complaint" as any, i, complaints.slice(0, 10))} className="border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors">
                          <td className="py-2 pr-2 text-xs">{c.date_entered || "—"}</td>
                          <td className="py-2 pr-2 text-xs">{c.category_description && c.category_description !== c.complaint_category ? c.category_description : c.complaint_category || "—"}</td>
                          <td className="py-2 pr-2 text-xs">
                            <span className={c.status === 'ACTIVE' ? 'text-red-600 font-medium' : 'text-gray-500'}>{c.status}</span>
                          </td>
                          <td className="py-2 pr-2 text-xs">{c.disposition_description && c.disposition_description !== c.disposition_code ? c.disposition_description : c.disposition_code || "—"}</td>
                          <td className="py-2 text-xs">{c.inspection_date || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalComplaints > 10 && <Link href={`/building/${bin}/complaints${qsStr}`} className="mt-2 block text-sm text-blue-600 hover:text-blue-800 font-medium">View all {totalComplaints} complaints →</Link>}
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-500">No DOB complaints on record</div>
              )}
            </div>
          </Collapsible>
          );
        })()}


        {/* HPD Litigations */}
        {(() => {
          const litigations = (data as any).litigations || [];
          const openLit = litigations.filter((l: any) => l.casestatus === 'OPEN');
          const closedLit = litigations.filter((l: any) => l.casestatus !== 'OPEN');
          if (litigations.length === 0) return null;
          return (
          <Collapsible
            id="litigations"
            title="HPD Litigations"
            subtitle="Lawsuits brought by NYC against the building owner for failing to fix violations"
            defaultOpen={openLit.length > 0}
            badge={<>
              {openLit.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">{openLit.length} Open</span>}
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">{litigations.length} Total</span>
            </>}
            glossary={<CodeGlossary sections={[
              { title: "Case Types", entries: [
                { code: "Heat and Hot Water", label: "HPD sued owner for failure to provide adequate heat or hot water" },
                { code: "Tenant Action", label: "HPD brought action on behalf of tenants for unresolved violations" },
                { code: "False Certification Non-Lead", label: "Owner falsely certified correction of non-lead violations", color: "text-red-500" },
                { code: "False Certification Lead", label: "Owner falsely certified correction of lead paint violations", color: "text-red-500" },
                { code: "Access Warrant - Non-Lead", label: "HPD obtained court order to access building for non-lead inspection" },
                { code: "Access Warrant - Lead", label: "HPD obtained court order to access building for lead inspection" },
                { code: "Comprehensive", label: "Broad action covering multiple violation categories" },
              ]},
              { title: "Case Judgement", entries: [
                { code: "YES", label: "Court ruled against the owner — judgement entered" },
                { code: "NO", label: "No judgement entered (case may be settled, dismissed, or ongoing)" },
              ]},
            ]} />}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <Stat label="Open Cases" value={openLit.length} color={openLit.length > 0 ? "text-red-600" : undefined} />
              <Stat label="Total Cases" value={litigations.length} />
              <Stat label="Judgements" value={litigations.filter((l: any) => l.casejudgement === 'YES').length} color="text-orange-500" />
              <Stat label="Case Types" value={[...new Set(litigations.map((l: any) => l.casetype))].length} />
            </div>
            {/* Case type breakdown */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {Object.entries(
                litigations.reduce((acc: Record<string, number>, l: any) => {
                  acc[l.casetype || 'Unknown'] = (acc[l.casetype || 'Unknown'] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).sort(([,a],[,b]) => (b as number) - (a as number)).map(([type, count]) => (
                <Callout key={type} label={type} value={count} warn={openLit.some((l: any) => l.casetype === type)} />
              ))}
            </div>
            {litigations.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                    <th className="pb-2 pr-2">Type</th><th className="pb-2 pr-2">Opened</th><th className="pb-2 pr-2">Status</th><th className="pb-2 pr-2">Judgement</th><th className="pb-2">Respondent</th>
                  </tr></thead>
                  <tbody>
                    {litigations.slice(0, 10).map((l: any, i: number) => (
                      <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 ${l.casestatus === 'OPEN' ? 'bg-red-50' : ''}`}>
                        <td className="py-2 pr-2 text-xs">{l.casetype}</td>
                        <td className="py-2 pr-2 text-xs">{formatDate(l.caseopendate)}</td>
                        <td className="py-2 pr-2 text-xs"><span className={l.casestatus === 'OPEN' ? 'text-red-600 font-medium' : ''}>{l.casestatus}</span></td>
                        <td className="py-2 pr-2 text-xs">{l.casejudgement === 'YES' ? '⚖️ Yes' : 'No'}</td>
                        <td className="py-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">{l.respondent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {litigations.length > 10 && <Link href={`/building/${bin}/litigations${qsStr}`} className="mt-2 block text-sm text-blue-600 hover:text-blue-800 font-medium">View all {litigations.length} litigations →</Link>}
              </div>
            )}
            <LegalNote>
              <strong>HPD Litigations</strong> are lawsuits brought by the NYC Department of Housing Preservation and Development against building owners for failing to correct violations. Under NYC Admin Code § 27-2115, HPD can sue landlords who ignore Class C violations. A history of repeated litigation indicates a pattern of neglect that tenants can cite in Housing Court proceedings.
            </LegalNote>
          </Collapsible>
          );
        })()}

        {/* Ownership */}
        <Collapsible title="Ownership" badge={
          <span className="text-xs text-gray-500 dark:text-gray-400">{(data.contacts || []).length} contacts</span>
        }>
          <div className="mt-4 text-sm space-y-4">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Registered Owner (HPD)</span>
              <div className="font-medium">{b.owner_name ? <Link href={`/owner/${encodeURIComponent(b.owner_name)}?from=${bin}`} className="text-blue-600 hover:text-blue-800 hover:underline">{b.owner_name}</Link> : "—"}</div>
            </div>
            {(data.contacts || []).length > 0 && (
              <div>
                <h4 className="text-gray-500 dark:text-gray-400 mb-2">HPD Registration Contacts</h4>
                <div className="space-y-2">
                  {(data.contacts || []).map((c: any, i: number) => {
                    const name = [c.firstname, c.lastname].filter(Boolean).join(' ');
                    const fullName = name || c.corporationname || '—';
                    const personLink = name ? `/owner/${encodeURIComponent(name)}?mode=contact&from=${bin}` : null;
                    const roleLabels: Record<string, string> = {
                      CorporateOwner: 'Corporate Owner',
                      IndividualOwner: 'Individual Owner',
                      Agent: 'Agent',
                      HeadOfficer: 'Head Officer',
                      SiteManager: 'Site Manager',
                    };
                    const role = roleLabels[c.type] || c.type || c.contactdescription || '';
                    const addr = [c.businesshousenumber, c.businessstreetname, c.businesscity, c.businessstate, c.businesszip].filter(Boolean).join(' ');
                    return (
                      <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded shrink-0">{role}</span>
                        <div>
                          <div className="font-medium">
                            {personLink ? (
                              <Link href={personLink} className="text-blue-600 hover:text-blue-800 hover:underline">{fullName}</Link>
                            ) : (
                              <span>{fullName}</span>
                            )}
                            {c.corporationname && name && <span className="text-gray-400 dark:text-gray-500 ml-1">({c.corporationname})</span>}
                          </div>
                          {addr && <div className="text-xs text-gray-400 dark:text-gray-500">{addr}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Collapsible>

        {/* Computed Scores */}
        <Collapsible title="Computed Scores">
          <div className="mt-4 flex items-center gap-6">
            <div className={`text-5xl font-bold px-6 py-3 rounded-xl ${gradeColor(b.score_grade)}`}>{b.score_grade || "?"}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>Open Class C: {b.open_class_c || 0}</div>
              <div>Total HPD: {b.total_hpd_violations || 0}</div>
              <div>Total ECB: {b.total_ecb_violations || 0}</div>
              <div>ECB Penalties: {fmt$(b.ecb_penalties)}</div>
              <div>TCO Expired: {b.tco_expired ? "Yes" : "No"}</div>
              <div>Unsigned Jobs: {b.unsigned_jobs || 0}</div>
            </div>
          </div>
        </Collapsible>
      </main>

      {/* Detail Drawers */}
      {drawerType === "hpd" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`Violation ${drawerItem.violationid || ""}`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          externalUrl={`https://a810-bisweb.nyc.gov/bisweb/ActionsByLocationServlet?requestid=0&allbin=${bin}&allinquirytype=BXS4OCV3&stypeocv3=V`}
          source="NYC Open Data · HPD Violations"
          fields={[
            { label: "Violation ID", value: drawerItem.violationid },
            { label: "Class", value: drawerItem.class },
            { label: "Apartment", value: drawerItem.apartment || "Building-wide" },
            { label: "Story/Floor", value: drawerItem.story },
            { label: "Inspection Date", value: formatDate(drawerItem.inspectiondate) },
            { label: "Violation Status", value: drawerItem.violationstatus },
            { label: "Current Status", value: drawerItem.currentstatus },
            { label: "Description", value: drawerItem.novdescription, full: true },
          ]}
        />
      )}
      {drawerType === "ecb" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`ECB ${drawerItem.ecb_violation_number || ""}`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          externalUrl={drawerItem.ecb_violation_number ? `https://a810-bisweb.nyc.gov/bisweb/ECBQueryByLocationServlet?requestid=0&allbin=${bin}` : undefined}
          source="NYC Open Data · DOB/ECB Violations"
          fields={[
            { label: "ECB Violation #", value: drawerItem.ecb_violation_number },
            { label: "Issue Date", value: formatDate(drawerItem.issue_date) },
            { label: "Status", value: drawerItem.ecb_violation_status },
            { label: "Severity", value: drawerItem.severity },
            { label: "Penalty Imposed", value: fmt$(drawerItem.penality_imposed) },
            { label: "Amount Paid", value: fmt$(drawerItem.amount_paid) },
            { label: "Balance Due", value: fmt$(drawerItem.balance_due) },
            { label: "Hearing Status", value: drawerItem.hearing_status },
            { label: "Description", value: drawerItem.violation_description, full: true },
            ...(drawerItem.tags && drawerItem.tags.length > 0 ? [{ label: "Hazard Tags", value: (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {drawerItem.tags.map((t: any, ti: number) => {
                  const highSev = ["fire-stopping", "asbestos", "lead", "structural", "egress"].includes(t.id);
                  return (
                    <span key={ti} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${highSev ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"}`}>
                      {t.icon} {t.label}
                    </span>
                  );
                })}
              </div>
            ), full: true }] : []),
            ...(drawerItem.extracted_apartments && drawerItem.extracted_apartments.length > 0 ? [{ label: "Apartments Mentioned", value: (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {drawerItem.extracted_apartments.map((apt: string, ai: number) => (
                  <span key={ai} className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    🏠 {apt}
                  </span>
                ))}
              </div>
            ) }] : []),
          ]}
          preFooter={(() => {
            const refs = drawerItem.cross_references;
            if (!refs || (!refs.jobs?.length && !refs.ecb_refs?.length && !refs.co_refs?.length)) return null;
            return (
              <div className="px-4 md:px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Connected Records</div>
                <div className="space-y-2">
                  {refs.jobs?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Job Numbers</div>
                      <div className="flex flex-wrap gap-1.5">
                        {refs.jobs.map((j: string) => (
                          <a key={j} href={`https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passession=&pasession=&tracker=&requestid=&allbin=&alession=&passession=&allisession=&passession=&allisn=${j}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer">
                            📋 Job #{j} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {refs.ecb_refs?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Related ECB Violations</div>
                      <div className="flex flex-wrap gap-1.5">
                        {refs.ecb_refs.map((r: string) => (
                          <span key={r} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                            ⚠️ ECB #{r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {refs.co_refs?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Certificate of Occupancy</div>
                      <div className="flex flex-wrap gap-1.5">
                        {refs.co_refs.map((c: string) => (
                          <span key={c} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                            📄 CO #{c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        />
      )}
      {drawerType === "permit" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`Job ${drawerItem.job || ""}`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          externalUrl={`https://a810-bisweb.nyc.gov/bisweb/JobsQueryByLocationServlet?requestid=0&allbin=${bin}`}
          source="NYC Open Data · BIS Job Filings + DOB NOW Permits"
          fields={[
            { label: "Job Number", value: drawerItem.job },
            { label: "Type", value: drawerItem.job_type },
            { label: "Work Type", value: drawerItem.work_type || "—" },
            { label: "Status", value: drawerItem.job_status_descrp },
            { label: "Risk", value: drawerItem.risk_tier === 'critical' ? 'Critical' : drawerItem.risk_tier === 'high' ? 'High' : drawerItem.risk_tier === 'warning' ? 'Warning' : drawerItem.risk_tier === 'low' ? 'Low' : drawerItem.risk_tier === 'clear' ? 'Signed Off' : drawerItem.risk_tier === 'none' ? 'None' : '—' },
            { label: "Last Action", value: formatDate(drawerItem.latest_action_date) },
            { label: "Description", value: drawerItem.job_description, full: true },
          ]}
        />
      )}
      {drawerType === "complaint" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`Complaint ${drawerItem.complaint_number || ""}`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          externalUrl={`https://a810-bisweb.nyc.gov/bisweb/ComplaintsByAddressServlet?requestid=0&allbin=${bin}`}
          source={drawerItem.bisweb ? "NYC Open Data + BISweb" : "NYC Open Data · DOB Complaints"}
          fields={[
            { label: "Complaint #", value: drawerItem.complaint_number },
            { label: "Date Filed", value: drawerItem.date_entered },
            { label: "Status", value: drawerItem.status },
            { label: "Category", value: drawerItem.bisweb?.category_full || (drawerItem.category_description && drawerItem.category_description !== drawerItem.complaint_category ? `${drawerItem.complaint_category} — ${drawerItem.category_description}` : drawerItem.complaint_category) },
            ...(drawerItem.bisweb?.description ? [{ label: "Re", value: redactSlurs(drawerItem.bisweb.description), full: true }] : []),
            { label: "Unit", value: drawerItem.unit },
            ...(drawerItem.bisweb?.assigned_to ? [{ label: "Assigned To", value: drawerItem.bisweb.assigned_to }] : []),
            { label: "Disposition", value: drawerItem.disposition_code ? (drawerItem.bisweb?.disposition_text || (drawerItem.disposition_description && drawerItem.disposition_description !== drawerItem.disposition_code ? `${drawerItem.disposition_code} — ${drawerItem.disposition_description}` : drawerItem.disposition_code)) : "—" },
            { label: "Disposition Date", value: drawerItem.disposition_date },
            { label: "Inspection Date", value: drawerItem.inspection_date },
            ...(drawerItem.bisweb?.last_inspection_badge ? [{ label: "Inspector Badge #", value: drawerItem.bisweb.last_inspection_badge }] : []),
            ...(drawerItem.bisweb?.comments ? [{ label: "Inspector Comments", value: redactSlurs(drawerItem.bisweb.comments), full: true }] : []),
          ]}
        />
      )}
      {drawerType === "safety" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`Safety Violation`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          externalUrl={`https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=1&block=${String(b.block || '').padStart(5, '0')}&lot=${String(b.lot || '').padStart(4, '0')}`}
          source="NYC Open Data · DOB Safety Violations"
          fields={[
            { label: "Violation #", value: drawerItem.violation_number },
            { label: "Issue Date", value: drawerItem.violation_issue_date ? drawerItem.violation_issue_date.slice(0, 10) : "—" },
            { label: "Status", value: drawerItem.violation_status },
            { label: "Type", value: drawerItem.violation_type },
            { label: "Device Type", value: drawerItem.device_type },
            { label: "Device #", value: drawerItem.device_number },
            { label: "Description", value: drawerItem.violation_remarks, full: true },
          ]}
        />
      )}
      {drawerType === "litigation" && drawerItem && (
        <DetailDrawer
          open={true}
          onClose={closeDrawer}
          onPrev={drawerIdx > 0 ? () => setDrawerIdx(drawerIdx - 1) : undefined}
          onNext={drawerIdx < drawerData.length - 1 ? () => setDrawerIdx(drawerIdx + 1) : undefined}
          title={`HPD Litigation`}
          subtitle={`${drawerIdx + 1} of ${drawerData.length}`}
          source="NYC Open Data · HPD Litigations"
          fields={[
            { label: "Litigation ID", value: drawerItem.litigationid },
            { label: "Case Type", value: drawerItem.casetype },
            { label: "Case Opened", value: drawerItem.caseopendate ? drawerItem.caseopendate.slice(0, 10) : "—" },
            { label: "Status", value: drawerItem.casestatus },
            { label: "Judgement", value: drawerItem.casejudgement || "—" },
            { label: "Respondent", value: drawerItem.respondent, full: true },
            { label: "Penalty", value: drawerItem.penalty },
            { label: "Finding of Harassment", value: drawerItem.findingofharassment || "—" },
          ]}
        />
      )}
    </div>
  );
}
