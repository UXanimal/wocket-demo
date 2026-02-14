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
  includeAiSummary: boolean;
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
  includeAiSummary: true,
  onlyOpen: true,
  dateFrom: "",
  dateTo: "",
  apartmentFilter: "",
};

// ─── Print & Legal Document Styles ───────────────────────

const legalStyles = `
  #report-content,
  #report-content h1,
  #report-content h2,
  #report-content h3,
  #report-content p,
  #report-content div,
  #report-content span,
  #report-content li {
    font-family: 'Times New Roman', Georgia, serif !important;
  }
  #report-content table,
  #report-content table th,
  #report-content table td {
    font-family: 'Inter', -apple-system, sans-serif !important;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .print\\:hidden { display: none !important; }
    .report-body {
      font-size: 12pt !important;
      line-height: 2 !important;
      max-width: none !important;
      padding: 0.75in 1in !important;
    }
    .report-body table {
      font-size: 9pt !important;
      line-height: 1.3 !important;
    }
    .report-body section { break-inside: avoid; }
    .report-footer { break-inside: avoid; }
  }
`;

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
  if (!dateStr) return true;
  if (!from && !to) return true;
  try {
    const d = new Date(dateStr).getTime();
    if (from && d < new Date(from).getTime()) return false;
    if (to && d > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  } catch { return true; }
}

function fmtFormalDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
  const now = new Date();
  const generatedDate = fmtFormalDate(now);
  const generatedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

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

  const displayLitigations = config.includeLitigations
    ? (config.onlyOpen && litigations.length === 0 ? filterByDate((data as any).litigations || [], "caseopendate") : litigations)
    : [];

  const totalItems = hpdViolations.length + ecbViolations.length + complaints.length + permits.length + displayLitigations.length + safetyViolations.length;

  // ─── Class C violations count ───
  const classCCount = hpdViolations.filter((v: any) => (v.class || "").toUpperCase() === "C").length;

  // ─── Legal Summary Builder ───
  function buildLegalSummary(): string {
    const parts: string[] = [];

    // Opening
    const violationTypes: string[] = [];
    if (config.includeHpd && hpdViolations.length > 0) violationTypes.push(`${hpdViolations.length} HPD housing maintenance code violation${hpdViolations.length !== 1 ? "s" : ""}`);
    if (config.includeEcb && ecbViolations.length > 0) violationTypes.push(`${ecbViolations.length} DOB/ECB violation${ecbViolations.length !== 1 ? "s" : ""}`);
    if (config.includeSafety && safetyViolations.length > 0) violationTypes.push(`${safetyViolations.length} DOB safety violation${safetyViolations.length !== 1 ? "s" : ""}`);
    if (config.includeComplaints && complaints.length > 0) violationTypes.push(`${complaints.length} DOB complaint${complaints.length !== 1 ? "s" : ""}`);
    if (config.includePermits && permits.length > 0) violationTypes.push(`${permits.length} uninspected or problematic permit${permits.length !== 1 ? "s" : ""}`);
    if (config.includeLitigations && displayLitigations.length > 0) violationTypes.push(`${displayLitigations.length} HPD litigation${displayLitigations.length !== 1 ? "s" : ""}`);

    if (violationTypes.length > 0) {
      const joined = violationTypes.length <= 2
        ? violationTypes.join(" and ")
        : violationTypes.slice(0, -1).join(", ") + ", and " + violationTypes[violationTypes.length - 1];
      parts.push(`This report documents ${joined} recorded against the premises located at ${address} (BIN: ${b.bin || bin}).`);
    } else {
      parts.push(`This report presents the building condition record for the premises located at ${address} (BIN: ${b.bin || bin}).`);
    }

    // Data sources
    parts.push("All data herein is derived from official records maintained by the New York City Department of Buildings (DOB), the Department of Housing Preservation and Development (HPD), and published via NYC Open Data (data.cityofnewyork.us).");

    // Date range note
    if (config.onlyOpen) {
      parts.push("This report is limited to currently open or active items" + (config.dateFrom || config.dateTo ? `, within the date range ${config.dateFrom || "earliest available"} through ${config.dateTo || "present"}` : "") + ".");
    }

    // TCO
    if (config.includeCoo && b.tco_expired) {
      parts.push("Notably, the building's Temporary Certificate of Occupancy has expired. Under New York Multiple Dwelling Law §301, a multiple dwelling may not be occupied without a valid Certificate of Occupancy, and the absence thereof may constitute a significant code violation relevant to habitability determinations.");
    }

    // Class C
    if (config.includeHpd && classCCount > 0) {
      parts.push(`The record includes ${classCCount} Class C (immediately hazardous) violation${classCCount !== 1 ? "s" : ""}. Pursuant to New York City Housing Maintenance Code §27-2115, Class C violations require correction within twenty-four (24) hours of placement.`);
    }

    // Apartment filter
    if (config.apartmentFilter) {
      parts.push(`This report has been filtered to records pertaining to Apartment ${config.apartmentFilter}.`);
    }

    parts.push("The complete record follows below.");

    return parts.join(" ");
  }

  return (
    <div className="min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: legalStyles }} />

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
                { key: "includeAiSummary", label: "AI Summary" },
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
      <div
        className="report-body max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none"
        style={{
          fontFamily: "'Times New Roman', Georgia, serif",
          fontSize: "12pt",
          lineHeight: "2",
        }}
        id="report-content"
      >
        {/* Report Header — Legal Document Caption */}
        <div className="border-b-2 border-gray-900 pb-4 mb-6" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "16pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            {address}
          </h1>
          <div style={{ fontSize: "14pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
            Building Condition Report
          </div>
          <div style={{ fontSize: "11pt", lineHeight: "1.6" }}>
            <div>BIN: {b.bin || bin} &nbsp;|&nbsp; Block: {b.block} &nbsp;|&nbsp; Lot: {b.lot} &nbsp;|&nbsp; Borough: {b.borough}</div>
            {config.apartmentFilter && <div>Apartment: {config.apartmentFilter}</div>}
            {b.owner_name && config.includeOwnership && <div>Registered Owner (HPD): {b.owner_name}</div>}
            <div style={{ marginTop: "4px" }}>Report Generated: {generatedDate} at {generatedTime}</div>
          </div>
        </div>

        {/* Report Summary — Legal Brief Style */}
        <div className="mb-6" style={{ lineHeight: "2" }}>
          <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
            Summary
          </h2>
          <p style={{ textIndent: "2em", marginBottom: "0" }}>
            {buildLegalSummary()}
          </p>
        </div>

        {/* AI Summary (hidden by default) */}
        {config.includeAiSummary && data.ai_summary && (
          <div className="mb-6" style={{ lineHeight: "2" }}>
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              AI-Generated Analysis
            </h2>
            <p style={{ textIndent: "2em" }}>{data.ai_summary}</p>
          </div>
        )}

        {/* Certificate of Occupancy */}
        {config.includeCoo && (
          <section className="mb-6 break-inside-avoid">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              Certificate of Occupancy
            </h2>
            <div style={{ lineHeight: "2" }}>
              <div><span style={{ fontWeight: 600 }}>Status:</span> <span className={b.tco_expired ? "text-red-600" : ""} style={b.tco_expired ? { fontWeight: 600 } : {}}>{b.co_status || "Unknown"}</span></div>
              {b.latest_tco_date && <div><span style={{ fontWeight: 600 }}>Latest TCO Date:</span> {fmtDate(b.latest_tco_date)}</div>}
              {b.co_status === "TCO" && <div><span style={{ fontWeight: 600 }}>TCO Expired:</span> <span className={b.tco_expired ? "text-red-600" : ""} style={b.tco_expired ? { fontWeight: 600 } : {}}>{b.tco_expired ? "YES" : "No"}</span></div>}
              {(data.unsigned_jobs || []).length > 0 && (
                <div><span style={{ fontWeight: 600 }}>Unsigned Major Jobs:</span> {(data.unsigned_jobs || []).length} (A1/NB jobs without final signoff)</div>
              )}
              {b.tco_expired && (
                <div style={{ marginTop: "8px", borderLeft: "2px solid #d1d5db", paddingLeft: "12px", fontSize: "11pt", fontStyle: "italic", color: "#4b5563" }}>
                  Note: Under NYC Multiple Dwelling Law § 301, a building without a valid Certificate of Occupancy may not be legally occupied.
                </div>
              )}
            </div>
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC Dept. of Buildings — Certificates of Occupancy (via NYC Open Data, dataset bs8b-p36w)</div>
          </section>
        )}

        {/* HPD Violations */}
        {config.includeHpd && hpdViolations.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              HPD Violations ({hpdViolations.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC HPD — Housing Maintenance Code Violations (via NYC Open Data, dataset wvxf-dwi5)</div>
          </section>
        )}

        {/* ECB Violations */}
        {config.includeEcb && ecbViolations.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              DOB/ECB Violations ({ecbViolations.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC DOB — ECB Violations (via NYC Open Data, dataset 6bgk-3dad)</div>
          </section>
        )}

        {/* DOB Safety Violations */}
        {config.includeSafety && safetyViolations.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              DOB Safety Violations ({safetyViolations.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC DOB — Safety Violations</div>
          </section>
        )}

        {/* DOB Complaints */}
        {config.includeComplaints && complaints.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              DOB Complaints ({complaints.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC DOB — Complaints Received (via NYC Open Data, dataset eabe-havv)</div>
          </section>
        )}

        {/* Permits */}
        {config.includePermits && permits.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              Permits — Uninspected / Problematic ({permits.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC DOB — BIS Job Filings (via NYC Open Data, dataset ic3t-wcy2) and DOB NOW Permits (dataset rbx6-tga4)</div>
          </section>
        )}

        {/* HPD Litigations */}
        {config.includeLitigations && displayLitigations.length > 0 && (
          <section className="mb-6">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              HPD Litigations ({displayLitigations.length})
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC HPD — Litigations (via NYC Open Data, dataset 59kj-x8nc)</div>
          </section>
        )}

        {/* Ownership */}
        {config.includeOwnership && contacts.length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 style={{ fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db", paddingBottom: "4px", marginBottom: "8px" }}>
              Ownership & Management
            </h2>
            <table className="w-full border-collapse" style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "9pt", lineHeight: "1.4" }}>
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
            <div style={{ marginTop: "4px", fontSize: "8pt", color: "#9ca3af" }}>Source: NYC HPD — Registration Contacts (via NYC Open Data, dataset feu5-w2e2)</div>
          </section>
        )}

        {/* Footer / Disclaimer */}
        <div className="report-footer" style={{ marginTop: "32px", paddingTop: "16px", borderTop: "2px solid #111827", fontSize: "10pt", color: "#6b7280", lineHeight: "1.6" }}>
          <p style={{ fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Data Sources & Disclaimer</p>
          <p style={{ marginBottom: "8px" }}>
            All data in this report is sourced from publicly available NYC government databases including the NYC Department of Buildings (DOB),
            the NYC Department of Housing Preservation and Development (HPD), and NYC Open Data (data.cityofnewyork.us).
            Data is updated periodically and may not reflect the most recent changes.
          </p>
          <p style={{ marginBottom: "8px" }}>
            This report is provided for informational purposes. While sourced from official city records,
            it should be independently verified. Under CPLR § 4520 and NYC Admin Code, official records
            from city agencies are generally admissible as evidence in Housing Court proceedings.
          </p>
          <p style={{ fontSize: "8pt", color: "#9ca3af" }}>
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
