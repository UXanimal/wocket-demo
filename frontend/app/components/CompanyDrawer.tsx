"use client";
import { useEffect, useState, useCallback } from "react";

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function fmt$(v: any) {
  if (v == null || v === 0) return "—";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface CompanyDrawerProps {
  open: boolean;
  onClose: () => void;
  companyName: string;
  currentBin?: string; // highlight current building
}

export default function CompanyDrawer({ open, onClose, companyName, currentBin }: CompanyDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "permits" | "violations" | "buildings">("overview");

  useEffect(() => {
    if (!open || !companyName) return;
    setLoading(true);
    fetch(`/api/company/${encodeURIComponent(companyName)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, companyName]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const s = data?.summary;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Drawer — offset slightly from right to show stacking */}
      <div className="relative w-full max-w-lg md:max-w-xl bg-white dark:bg-[#1a1b2e] shadow-2xl overflow-y-auto animate-slide-in-right max-md:max-w-full max-md:rounded-t-2xl max-md:mt-12 md:mr-4">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Construction Company</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{companyName}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">×</button>
          </div>
          
          {/* Tabs */}
          {!loading && data && (
            <div className="flex gap-1 mt-3">
              {(["overview", "permits", "violations", "buildings"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${
                    activeTab === tab 
                      ? "bg-blue-600 text-white" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab}
                  {tab === "permits" && ` (${s?.total_permits || 0})`}
                  {tab === "violations" && ` (${s?.total_ecb_violations || 0})`}
                  {tab === "buildings" && ` (${s?.total_buildings || 0})`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 md:px-6 py-4">
          {loading && <div className="text-gray-400 text-sm py-8 text-center">Loading company profile...</div>}
          
          {!loading && data && activeTab === "overview" && (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg px-3 py-2">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.total_permits}</div>
                  <div className="text-xs text-gray-500">Permits Filed</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#0f1117] rounded-lg px-3 py-2">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.total_buildings}</div>
                  <div className="text-xs text-gray-500">Buildings</div>
                </div>
                <div className={`rounded-lg px-3 py-2 ${s.total_ecb_violations > 0 ? "bg-red-50 dark:bg-red-900/10" : "bg-gray-50 dark:bg-[#0f1117]"}`}>
                  <div className={`text-2xl font-bold ${s.total_ecb_violations > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>{s.total_ecb_violations}</div>
                  <div className="text-xs text-gray-500">ECB Violations</div>
                </div>
                <div className={`rounded-lg px-3 py-2 ${s.total_penalties > 0 ? "bg-red-50 dark:bg-red-900/10" : "bg-gray-50 dark:bg-[#0f1117]"}`}>
                  <div className={`text-2xl font-bold ${s.total_penalties > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>{fmt$(s.total_penalties)}</div>
                  <div className="text-xs text-gray-500">Total Penalties</div>
                </div>
              </div>
              
              {/* Class 1 callout */}
              {s.class1_violations > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <span className="text-red-600 font-bold text-sm">{s.class1_violations} Class 1 (Immediately Hazardous)</span>
                  <span className="text-red-500 text-xs ml-2">violations as respondent</span>
                </div>
              )}
              
              {/* Comparison */}
              {s.comparison && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-3">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">vs. City Average (contractors with 5+ permits)</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Permits</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{s.total_permits} <span className="text-gray-400">vs avg {Math.round(s.comparison.avg_permits)}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Buildings</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{s.total_buildings} <span className="text-gray-400">vs avg {Math.round(s.comparison.avg_buildings)}</span></span>
                    </div>
                    <div className="text-gray-400 mt-1">out of {s.comparison.total_contractors.toLocaleString()} contractors</div>
                  </div>
                </div>
              )}
              
              {/* Connected companies */}
              {data.connected_companies?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Other Contractors on Same Buildings</div>
                  <div className="space-y-1">
                    {data.connected_companies.map((c: any) => (
                      <div key={c.applicant_business_name} className="flex justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{c.applicant_business_name}</span>
                        <span className="text-gray-400 whitespace-nowrap">{c.permits} permits · {c.buildings} bldgs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && data && activeTab === "permits" && (
            <div className="space-y-2">
              {data.permits.map((p: any, i: number) => (
                <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${currentBin && p.bin === currentBin ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <a href={`/building/${p.bin}`} className="text-blue-600 hover:text-blue-800 font-medium text-sm">{p.address || p.bin}</a>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.permit_status === "Signed-off" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.permit_status}</span>
                  </div>
                  <div className="text-gray-500 truncate">{p.job_description}</div>
                  <div className="flex gap-3 mt-1 text-gray-400">
                    <span>{formatDate(p.issued_date)}</span>
                    {p.work_type && <span>{p.work_type}</span>}
                    {p.estimated_job_costs && <span>{fmt$(p.estimated_job_costs)}</span>}
                    {p.work_on_floor && <span>{p.work_on_floor}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && data && activeTab === "violations" && (
            <div className="space-y-2">
              {data.ecb_violations.length === 0 && <div className="text-gray-400 text-sm py-4 text-center">No ECB violations found</div>}
              {data.ecb_violations.map((v: any, i: number) => (
                <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${currentBin && v.bin === currentBin ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex justify-between items-start mb-1">
                    <a href={`/building/${v.bin}`} className="text-blue-600 hover:text-blue-800 font-medium text-sm">{v.address || v.bin}</a>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${v.severity?.includes("1") ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{v.severity}</span>
                  </div>
                  <div className="text-gray-500 truncate">{v.violation_description}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-400">{formatDate(v.issue_date)}</span>
                    <span className={v.ecb_violation_status === "RESOLVE" ? "text-gray-400" : "text-red-600 font-medium"}>{v.ecb_violation_status}</span>
                    {v.penality_imposed > 0 && <span className="text-gray-400">{fmt$(v.penality_imposed)}</span>}
                  </div>
                  {v.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {v.tags.map((t: any) => {
                        const highSev = ["fire-stopping", "asbestos", "lead", "structural", "egress"].includes(t.id);
                        return <span key={t.id} className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${highSev ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>{t.icon} {t.label}</span>;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && data && activeTab === "buildings" && (
            <div className="space-y-2">
              {data.buildings.map((b: any, i: number) => (
                <a key={i} href={`/building/${b.bin}`} className={`block border rounded-lg px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${currentBin && b.bin === currentBin ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.address || b.bin}</div>
                      <div className="text-gray-400">{b.borough}</div>
                      {(b.corporate_owner || b.individual_owner || b.agent_name || b.head_officer) && (
                        <div className="mt-1 text-gray-500 dark:text-gray-400">
                          {b.corporate_owner && <div>{b.corporate_owner}</div>}
                          {b.individual_owner && <div>Owner: {b.individual_owner}</div>}
                          {b.head_officer && <div>Head Officer: {b.head_officer}</div>}
                          {b.agent_name && <div>Agent: {b.agent_name}</div>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.open_class_c > 0 && <span className="text-red-600 font-medium">{b.open_class_c} Class C</span>}
                      {b.score_grade && <span className={`px-2 py-0.5 rounded font-bold ${b.score_grade === "F" ? "bg-red-100 text-red-700" : b.score_grade === "D" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>{b.score_grade}</span>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
