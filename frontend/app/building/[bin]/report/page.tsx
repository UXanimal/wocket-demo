"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────

interface ReportConfig {
  includeHpd: boolean;
  includeEcb: boolean;
  includeComplaints: boolean;
  includePermits: boolean;
  includeLitigations: boolean;
  includeSafety: boolean;
  includeCoo: boolean;
  includeOwnership: boolean;
  onlyOpen: boolean;
  dateFrom: string;
  dateTo: string;
  apartmentFilter: string;
}

const DEFAULT_CONFIG: ReportConfig = {
  includeHpd: true,
  includeEcb: true,
  includeComplaints: true,
  includePermits: true,
  includeLitigations: true,
  includeSafety: true,
  includeCoo: true,
  includeOwnership: true,
  onlyOpen: true,
  dateFrom: "",
  dateTo: "",
  apartmentFilter: "",
};

// ─── Helpers ─────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }); }
  catch { return d; }
}

function fmt$(v: any) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysOpen(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return days > 0 ? days : null;
  } catch { return null; }
}

function fmtDays(days: number | null) {
  if (!days) return "";
  if (days > 365) return `${Math.floor(days / 365)}y ${days % 365}d`;
  return `${days}d`;
}

function inDateRange(dateStr: string | null, from: string, to: string): boolean {
  if (!dateStr) return true; // include items with no date
  if (!from && !to) return true;
  try {
    const d = new Date(dateStr).getTime();
    if (from && d < new Date(from).getTime()) return false;
    if (to && d > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  } catch { return true; }
}

// ─── Report Page ─────────────────────────────────────────

function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bin = params.bin as string;
  const apt = searchParams.get("apt") || "";
  const addrParam = searchParams.get("addr") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ReportConfig>({
    ...DEFAULT_CONFIG,
    apartmentFilter: apt,
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/building/${bin}${apt ? `?apt=${encodeURIComponent(apt)}` : ""}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bin, apt]);

  const updateConfig = (patch: Partial<ReportConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 text-lg">Loading report data...</div></div>;
  if (!data?.building) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">Building not found</div></div>;

  const b = data.building;
  const address = addrParam || b.address;
  const generatedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const generatedTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // ─── Filter data based on config ───
  const filterByDate = (items: any[], dateKey: string) => {
    return items.filter(item => inDateRange(item[dateKey], config.dateFrom, config.dateTo));
  };

  const hpdViolations = config.includeHpd
    ? filterByDate(data.open_violations || [], "inspectiondate")
        .filter(v => !config.onlyOpen || v.violationstatus === "Open")
        .filter(v => !config.apartmentFilter || (v.apartment || "").toUpperCase().includes(config.apartmentFilter.toUpperCase()))
    : [];

  const ecbViolations = config.includeEcb
    ? filterByDate(data.ecb_violations || [], "issue_date")
        .filter(v => !config.onlyOpen || !["RESOLVE", "DISMISS"].includes((v.ecb_violation_status || "").toUpperCase()))
    : [];

  const complaints = config.includeComplaints
    ? filterByDate((data as any).complaints || [], "date_entered")
        .filter(c => !config.onlyOpen || c.status === "ACTIVE")
    : [];

  const permits = (() => {
    if (!config.includePermits) return [];
    const bisJobs = (data.bis_jobs || []).filter((j: any) =>
      !config.onlyOpen || (!j.signed_off && (j.no_final_inspection || j.risk_tier === "critical" || j.risk_tier === "warning" || j.risk_tier === "active"))
    );
    return filterByDate(bisJobs, "latest_action_date");
  })();

  const litigations = config.includeLitigations
    ? filterByDate((data as any).litigations || [], "caseopendate")
        .filter(l => !config.onlyOpen || l.casestatus === "OPEN")
    : [];

  const safetyViolations = config.includeSafety
    ? filterByDate((data as any).safety_violations || [], "violation_issue_date")
        .filter(v => !config.onlyOpen || v.violation_status === "Active")
    : [];

  const coRecords = config.includeCoo ? (data.co_records || []) : [];
  const contacts = config.includeOwnership ? (data.contacts || []) : [];

  // For litigations: if onlyOpen is true but none are open, show all (they're historically important)
  const displayLitigations = config.includeLitigations
    ? (config.onlyOpen && litigations.length === 0 ? filterByDate((data as any).litigations || [], "caseopendate") : litigations)
    : [];

  const totalItems = hpdViolations.length + ecbViolations.length + complaints.length + permits.length + displayLitigations.length + safetyViolations.length;

  return (
    <div className="min-h-screen bg-white">
      {/* Screen-only controls */}
      <div className="print:hidden bg-gray-50 border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/building/${bin}${apt ? `?apt=${encodeURIComponent(apt)}${addrParam ? `&addr=${encodeURIComponent(addrParam)}` : ""}` : addrParam ? `?addr=${encodeURIComponent(addrParam)}` : ""}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium">← Back to report card</Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 transition-colors"
            >
              {editing ? "Done" : "✏️ Edit"}
            </button>
            <button
              onClick={() => window.print()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              💾 Save PDF
            </button>
          </div>
        </div>

        {/* Edit panel */}
        {editing && (
          <div className="max-w-4xl mx-auto mt-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Report Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { key: "includeHpd", label: "HPD Violations" },
                { key: "includeEcb", label: "DOB/ECB Violations" },
                { key: "includeComplaints", label: "DOB Complaints" },
                { key: "includePermits", label: "Permits" },
                { key: "includeLitigations", label: "HPD Litigations" },
                { key: "includeSafety", label: "Safety Violations" },
                { key: "includeCoo", label: "Certificate of Occupancy" },
                { key: "includeOwnership", label: "Ownership" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config as any)[key]}
                    onChange={e => updateConfig({ [key]: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.onlyOpen}
                  onChange={e => updateConfig({ onlyOpen: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Only open/active items
              </label>
              <div>
                <label className="text-xs text-gray-500 block mb-1">From date</label>
                <input
                  type="date"
                  value={config.dateFrom}
                  onChange={e => updateConfig({ dateFrom: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To date</label>
                <input
                  type="date"
                  value={config.dateTo}
                  onChange={e => updateConfig({ dateTo: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Apartment</label>
                <input
                  type="text"
                  value={config.apartmentFilter}
                  onChange={e => updateConfig({ apartmentFilter: e.target.value })}
                  placeholder="e.g. 11A"
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                />
              </div>
              <button
                onClick={() => setConfig({ ...DEFAULT_CONFIG, apartmentFilter: apt })}
                className="text-xs text-blue-600 hover:text-blue-800 underline pb-1"
              >
                Reset defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Printable Report ─── */}
      <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        {/* Report Header */}
        <div className="border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Building Condition Report</h1>
          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div><span className="font-semibold">Address:</span> {address}</div>
            <div><span className="font-semibold">BIN:</span> {b.bin || bin}</div>
            <div><span className="font-semibold">Block:</span> {b.block}  <span className="font-semibold ml-3">Lot:</span> {b.lot}</div>
            <div><span className="font-semibold">Borough:</span> {b.borough}</div>
            {config.apartmentFilter && <div><span className="font-semibold">Apartment:</span> {config.apartmentFilter}</div>}
            <div><span className="font-semibold">Report Generated:</span> {generatedDate} at {generatedTime}</div>
          </div>
          {b.owner_name && config.includeOwnership && (
            <div className="mt-2 text-sm"><span className="font-semibold">Registered Owner (HPD):</span> {b.owner_name}</div>
          )}
        </div>

        {/* Report Summary */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 print:bg-white print:border-gray-300">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {config.includeHpd && <div>HPD Violations: <strong>{hpdViolations.length}</strong></div>}
            {config.includeEcb && <div>DOB/ECB Violations: <strong>{ecbViolations.length}</strong></div>}
            {config.includeComplaints && <div>DOB Complaints: <strong>{complaints.length}</strong></div>}
            {config.includePermits && <div>Permits (uninspected): <strong>{permits.length}</strong></div>}
            {config.includeLitigations && <div>HPD Litigations: <strong>{displayLitigations.length}</strong></div>}
            {config.includeSafety && <div>Safety Violations: <strong>{safetyViolations.length}</strong></div>}
            {config.includeCoo && <div>C of O Status: <strong className={b.tco_expired ? "text-red-600" : ""}>{b.tco_expired ? "EXPIRED TCO" : b.co_status || "Unknown"}</strong></div>}
          </div>
          {config.onlyOpen && <div className="mt-2 text-xs text-gray-500 italic">Showing open/active items only{config.dateFrom || config.dateTo ? ` • Date range: ${config.dateFrom || "any"} to ${config.dateTo || "present"}` : ""}</div>}
        </div>

        {/* Certificate of Occupancy */}
        {config.includeCoo && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">Certificate of Occupancy</h2>
            <div className="text-sm space-y-1">
              <div><span className="font-semibold">Status:</span> <span className={b.tco_expired ? "text-red-600 font-semibold" : ""}>{b.co_status || "Unknown"}</span></div>
              {b.latest_tco_date && <div><span className="font-semibold">Latest TCO Date:</span> {fmtDate(b.latest_tco_date)}</div>}
              <div><span className="font-semibold">TCO Expired:</span> <span className={b.tco_expired ? "text-red-600 font-semibold" : ""}>{b.tco_expired ? "YES" : "No"}</span></div>
              {(data.unsigned_jobs || []).length > 0 && (
                <div><span className="font-semibold">Unsigned Major Jobs:</span> {(data.unsigned_jobs || []).length} (A1/NB jobs without final signoff)</div>
              )}
              {b.tco_expired && (
                <div className="mt-2 text-xs text-gray-600 italic border-l-2 border-gray-300 pl-3">
                  Note: Under NYC Multiple Dwelling Law § 301, a building without a valid Certificate of Occupancy may not be legally occupied. See Kozak v. Kushner Village LLC (App. Div. 1st Dept., 2024).
                </div>
              )}
            </div>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC Dept. of Buildings — Certificates of Occupancy (via NYC Open Data, dataset bs8b-p36w)</div>
          </section>
        )}

        {/* HPD Violations */}
        {config.includeHpd && hpdViolations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              HPD Violations ({hpdViolations.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">ID</th>
                  <th className="pb-1 pr-2 font-semibold">Class</th>
                  <th className="pb-1 pr-2 font-semibold">Apt</th>
                  <th className="pb-1 pr-2 font-semibold">Date</th>
                  <th className="pb-1 pr-2 font-semibold">Open</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {hpdViolations.map((v: any, i: number) => {
                  const days = v.violationstatus === "Open" ? daysOpen(v.inspectiondate) : null;
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-2">{v.violationid}</td>
                      <td className="py-1 pr-2 font-semibold">{v.class}</td>
                      <td className="py-1 pr-2">{v.apartment || "—"}</td>
                      <td className="py-1 pr-2">{fmtDate(v.inspectiondate)}</td>
                      <td className="py-1 pr-2">{days ? fmtDays(days) : "—"}</td>
                      <td className="py-1 pr-2">{v.violationstatus}</td>
                      <td className="py-1">{v.novdescription}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC HPD — Housing Maintenance Code Violations (via NYC Open Data, dataset wvxf-dwi5)</div>
          </section>
        )}

        {/* ECB Violations */}
        {config.includeEcb && ecbViolations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              DOB/ECB Violations ({ecbViolations.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">Number</th>
                  <th className="pb-1 pr-2 font-semibold">Date</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 pr-2 font-semibold">Penalty</th>
                  <th className="pb-1 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {ecbViolations.map((v: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{v.ecb_violation_number}</td>
                    <td className="py-1 pr-2">{fmtDate(v.issue_date)}</td>
                    <td className="py-1 pr-2">{v.ecb_violation_status}</td>
                    <td className="py-1 pr-2">{fmt$(v.penality_imposed)}</td>
                    <td className="py-1">{v.violation_description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC DOB — ECB Violations (via NYC Open Data, dataset 6bgk-3dad)</div>
          </section>
        )}

        {/* DOB Safety Violations */}
        {config.includeSafety && safetyViolations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              DOB Safety Violations ({safetyViolations.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">Number</th>
                  <th className="pb-1 pr-2 font-semibold">Date</th>
                  <th className="pb-1 pr-2 font-semibold">Device</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {safetyViolations.map((v: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{v.violation_number}</td>
                    <td className="py-1 pr-2">{fmtDate(v.violation_issue_date)}</td>
                    <td className="py-1 pr-2">{v.device_type || "—"}</td>
                    <td className="py-1 pr-2">{v.violation_status}</td>
                    <td className="py-1">{v.violation_remarks || v.violation_type || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC DOB — Safety Violations</div>
          </section>
        )}

        {/* DOB Complaints */}
        {config.includeComplaints && complaints.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              DOB Complaints ({complaints.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">Number</th>
                  <th className="pb-1 pr-2 font-semibold">Date</th>
                  <th className="pb-1 pr-2 font-semibold">Category</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 font-semibold">Disposition</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{c.complaint_number}</td>
                    <td className="py-1 pr-2">{c.date_entered}</td>
                    <td className="py-1 pr-2">{c.category_description || c.complaint_category}</td>
                    <td className="py-1 pr-2">{c.status}</td>
                    <td className="py-1">{c.disposition_description || c.disposition_code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC DOB — Complaints Received (via NYC Open Data, dataset eabe-havv)</div>
          </section>
        )}

        {/* Permits */}
        {config.includePermits && permits.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              Permits — Uninspected / Problematic ({permits.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">Job #</th>
                  <th className="pb-1 pr-2 font-semibold">Type</th>
                  <th className="pb-1 pr-2 font-semibold">Work</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 pr-2 font-semibold">Date</th>
                  <th className="pb-1 font-semibold">Inspection</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((j: any, i: number) => {
                  const days = !j.signed_off ? daysOpen(j.latest_action_date) : null;
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-2">{j.job}</td>
                      <td className="py-1 pr-2">{j.job_type}</td>
                      <td className="py-1 pr-2">{j.work_type || "—"}</td>
                      <td className="py-1 pr-2">{j.job_status_descrp}</td>
                      <td className="py-1 pr-2">{fmtDate(j.latest_action_date)}</td>
                      <td className="py-1">{j.signed_off ? "Signed off" : j.no_final_inspection ? `⚠ No final (${fmtDays(days)})` : j.risk_tier === "active" ? `Pending (${fmtDays(days)})` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC DOB — BIS Job Filings (via NYC Open Data, dataset ic3t-wcy2) and DOB NOW Permits (dataset rbx6-tga4)</div>
          </section>
        )}

        {/* HPD Litigations */}
        {config.includeLitigations && displayLitigations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
              HPD Litigations ({displayLitigations.length})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">ID</th>
                  <th className="pb-1 pr-2 font-semibold">Type</th>
                  <th className="pb-1 pr-2 font-semibold">Opened</th>
                  <th className="pb-1 pr-2 font-semibold">Status</th>
                  <th className="pb-1 pr-2 font-semibold">Judgement</th>
                  <th className="pb-1 font-semibold">Respondent</th>
                </tr>
              </thead>
              <tbody>
                {displayLitigations.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{l.litigationid}</td>
                    <td className="py-1 pr-2">{l.casetype}</td>
                    <td className="py-1 pr-2">{fmtDate(l.caseopendate)}</td>
                    <td className="py-1 pr-2">{l.casestatus}</td>
                    <td className="py-1 pr-2">{l.casejudgement}</td>
                    <td className="py-1">{l.respondent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC HPD — Litigations (via NYC Open Data, dataset 59kj-x8nc)</div>
          </section>
        )}

        {/* Ownership */}
        {config.includeOwnership && contacts.length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">Ownership & Management</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pb-1 pr-2 font-semibold">Role</th>
                  <th className="pb-1 pr-2 font-semibold">Name</th>
                  <th className="pb-1 pr-2 font-semibold">Organization</th>
                  <th className="pb-1 font-semibold">Address</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any, i: number) => {
                  const roleLabels: Record<string, string> = {
                    CorporateOwner: "Corporate Owner", IndividualOwner: "Individual Owner",
                    Agent: "Agent", HeadOfficer: "Head Officer", SiteManager: "Site Manager",
                  };
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 pr-2">{roleLabels[c.type] || c.type}</td>
                      <td className="py-1 pr-2">{[c.firstname, c.lastname].filter(Boolean).join(" ") || "—"}</td>
                      <td className="py-1 pr-2">{c.corporationname || "—"}</td>
                      <td className="py-1">{[c.businesshousenumber, c.businessstreetname, c.businesscity, c.businessstate, c.businesszip].filter(Boolean).join(" ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-gray-400">Source: NYC HPD — Registration Contacts (via NYC Open Data, dataset feu5-w2e2)</div>
          </section>
        )}

        {/* Footer / Disclaimer */}
        <div className="mt-8 pt-4 border-t-2 border-gray-900 text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-700">Data Sources & Disclaimer</p>
          <p>
            All data in this report is sourced from publicly available NYC government databases including the NYC Department of Buildings (DOB),
            the NYC Department of Housing Preservation and Development (HPD), and NYC Open Data (data.cityofnewyork.us).
            Data is updated periodically and may not reflect the most recent changes.
          </p>
          <p>
            This report is provided for informational purposes. While sourced from official city records,
            it should be independently verified. Under CPLR § 4520 and NYC Admin Code, official records
            from city agencies are generally admissible as evidence in Housing Court proceedings.
          </p>
          <p className="text-[10px] text-gray-400">
            Generated by Wocket · {generatedDate} at {generatedTime} · {totalItems} items included
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportPageWrapper() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 text-lg">Loading...</div></div>}><ReportPage /></Suspense>;
}
