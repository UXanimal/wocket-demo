"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

/* ─── Helpers ─── */

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

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; }
}

function fmt$(v: any) {
  if (v == null) return "$0";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function gradeColor(g: string | null) {
  if (!g) return "bg-gray-300 text-gray-700";
  if (g === "A") return "bg-green-500 text-white";
  if (g === "B") return "bg-blue-500 text-white";
  if (g === "C") return "bg-yellow-500 text-white";
  if (g === "D") return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

/* ─── Reusable card ─── */
function InfoCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusCard({ icon, label, value, status, statusColor }: { icon: string; label: string; value: string | number; status?: string; statusColor?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex gap-3 items-start">
      <span className="text-2xl leading-none mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
        {status && <div className={`text-xs mt-0.5 ${statusColor || "text-gray-400"}`}>{status}</div>}
      </div>
    </div>
  );
}

/* ─── Print styles ─── */
const printStyles = `
  @media print {
    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print\\:hidden { display: none !important; }
    .report-container { padding: 0.5in 0.75in !important; max-width: none !important; }
    .report-container section { break-inside: avoid; }
    .no-break { break-inside: avoid; }
  }
`;

/* ─── Main Page ─── */
function RentersReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bin = params.bin as string;
  const apt = searchParams.get("apt") || "";
  const addrParam = searchParams.get("addr") || "";

  const [data, setData] = useState<any>(null);
  const [percentiles, setPercentiles] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://wocket-demo-production-adad.up.railway.app";

  useEffect(() => {
    const url = apt ? `/api/building/${bin}?apt=${encodeURIComponent(apt)}` : `/api/building/${bin}`;
    Promise.all([
      fetch(url).then(r => r.json()).catch(() => null),
      fetch(`${apiBase}/api/building/${bin}/percentiles`).then(r => r.json()).catch(() => null),

    ]).then(([d, p]) => {
      setData(d);
      setPercentiles(p);
    }).finally(() => setLoading(false));
  }, [bin, apt, apiBase]);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-white"><div className="text-gray-400 text-lg">Generating report...</div></div>;
  if (!data?.building) return <div className="flex items-center justify-center min-h-screen bg-white"><div className="text-red-500">Building not found</div></div>;

  const b = data.building;
  const address = addrParam || b.address;
  const openViolations = data.open_violations || [];
  const ecb = data.ecb_violations || [];
  const openOnly = openViolations.filter((v: any) => v.violationstatus === "Open");
  const safety = data.safety_violations || [];
  const complaints = data.complaints || [];
  const litigations = data.litigations || [];
  const bisJobs = data.bis_jobs || [];
  const detailedPermits = data.detailed_permits || [];

  // Counts
  const openC = openOnly.filter((v: any) => v.class === "C").length;
  const openB = openOnly.filter((v: any) => v.class === "B").length;
  const leadOpen = keywordCount(openOnly, ["lead", "lead-based"]);
  const leadTotal = keywordCount(openViolations, ["lead", "lead-based"]);
  const pestOpen = keywordCount(openOnly, ["roach", "mice", "rat", "pest", "vermin", "bed bug"]);
  const pestTotal = keywordCount(openViolations, ["roach", "mice", "rat", "pest", "vermin", "bed bug"]);
  const moldOpen = keywordCount(openOnly, ["mold", "mildew"]);
  const moldTotal = keywordCount(openViolations, ["mold", "mildew"]);
  const fireOpen = keywordCount(openOnly, ["fire", "smoke detector", "carbon monoxide", "sprinkler"]);
  const elevatorViolations = safety.filter((v: any) => (v.device_type || "").toLowerCase().includes("elev"));
  const elevatorActive = elevatorViolations.filter((v: any) => v.violation_status === "Active").length;
  const totalEcbPenalties = ecb.reduce((s: number, v: any) => s + (parseFloat(v.penality_imposed) || 0), 0);

  // Construction
  const allPermits = [...bisJobs.map((j: any) => ({ ...j, source: "BIS" })), ...detailedPermits];
  const recentActive = allPermits.filter((j: any) => {
    if (j.signed_off || j.risk_tier === "clear") return false;
    const desc = (j.job_description || "").toUpperCase();
    if (desc.includes("NO WORK")) return false;
    const d = j.latest_action_date || j.issued_date;
    if (!d) return false;
    return (Date.now() - new Date(d).getTime()) / 86400000 < 730;
  });
  const workTypes = [...new Set(recentActive.map((j: any) => j.work_type).filter(Boolean))];
  const hasStructural = workTypes.some(w => ["General Construction", "Structural", "Foundation"].includes(w));
  const countActive = recentActive.length;
  const earliestDate = recentActive.map((j: any) => j.latest_action_date || j.issued_date).filter(Boolean).sort()[0];
  const durationMonths = earliestDate ? Math.round((Date.now() - new Date(earliestDate as string).getTime()) / (30 * 86400000)) : 0;
  const durationStr = durationMonths >= 24 ? `${Math.floor(durationMonths / 12)}+ years` : durationMonths >= 1 ? `${durationMonths} months` : "recent";
  let constructionLevel = "None";
  if (countActive > 10 || hasStructural) constructionLevel = "Heavy";
  else if (countActive > 3 || workTypes.length > 1) constructionLevel = "Moderate";
  else if (countActive > 0) constructionLevel = "Minor";


  // Litigations
  const openLit = litigations.filter((l: any) => l.casestatus === "OPEN");
  const judgements = litigations.filter((l: any) => l.casejudgement === "YES").length;

  // Apartment-specific
  const aptViolations = apt ? openViolations.filter((v: any) => v.is_unit_match) : [];
  const aptOpenViolations = aptViolations.filter((v: any) => v.violationstatus === "Open");
  const aptPermits = apt ? allPermits.filter((p: any) => p.is_unit_match) : [];

  const now = new Date();
  const generatedDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Back link
  const qs = new URLSearchParams();
  if (apt) qs.set("apt", apt);
  if (addrParam) qs.set("addr", addrParam);
  const qsStr = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ colorScheme: "light", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Top bar */}
      <div className="print:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href={`/building/${bin}${qsStr}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">← Back to building</Link>
          <button onClick={() => window.print()} className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            🖨️ Print Report
          </button>
        </div>
      </div>

      <div className="report-container max-w-4xl mx-auto px-4 py-8">

        {/* ─── Header ─── */}
        <header className="mb-8 no-break">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Renter&apos;s Report</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{address}</h1>
              <div className="text-sm text-gray-500">{b.borough} · BIN {bin}</div>
              {apt && <div className="mt-2 inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-lg">Prepared for Apartment {apt}</div>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-2xl font-bold w-12 h-12 flex items-center justify-center rounded-xl ${gradeColor(b.score_grade)}`}>{b.score_grade || "?"}</span>
            </div>
          </div>

          {/* Map */}
          {data.latitude && data.longitude && (
            <div className="rounded-xl overflow-hidden border border-gray-200 h-[200px] mb-4">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.longitude - 0.004},${data.latitude - 0.003},${data.longitude + 0.004},${data.latitude + 0.003}&layer=mapnik&marker=${data.latitude},${data.longitude}`}
                className="w-full h-full border-0"
                loading="lazy"
                title="Map"
              />
            </div>
          )}

          <div className="text-xs text-gray-400">Generated {generatedDate}</div>
        </header>

        {/* ─── 1. Building Overview ─── */}
        <section className="mb-8 no-break">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Building Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard label="Address" value={address} />
            <InfoCard label="Borough" value={b.borough || "—"} />
            <InfoCard label="Building Type" value={b.building_class || "—"} />
            <InfoCard label="C of O Status" value={b.co_status || "No record"} sub={b.tco_expired ? "⚠️ TCO Expired" : undefined} />
            <InfoCard label="Total Units" value={b.existing_dwelling_units || "—"} />
            <InfoCard label="Owner" value={b.owner_name || "—"} />
            <InfoCard label="Grade" value={b.score_grade || "?"} />
          </div>
        </section>

        {/* ─── 2. Safety Snapshot ─── */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Safety Snapshot</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatusCard icon="🚨" label="Class C Violations" value={openC} status="Immediately Hazardous" statusColor={openC > 0 ? "text-red-600 font-medium" : "text-gray-400"} />
            <StatusCard icon="⚠️" label="Class B Violations" value={openB} status="Hazardous" statusColor={openB > 0 ? "text-orange-600" : "text-gray-400"} />
            <StatusCard icon="🎨" label="Lead Paint" value={`${leadOpen} open`} status={`${leadTotal} total history`} statusColor={leadOpen > 0 ? "text-red-600 font-medium" : "text-gray-400"} />
            <StatusCard icon="🐛" label="Pest Violations" value={`${pestOpen} open`} status={`${pestTotal} total history`} statusColor={pestOpen > 0 ? "text-orange-600" : "text-gray-400"} />
            <StatusCard icon="🌫️" label="Mold" value={`${moldOpen} open`} status={`${moldTotal} total history`} statusColor={moldOpen > 0 ? "text-orange-600" : "text-gray-400"} />
            <StatusCard icon="🔥" label="Fire Safety" value={fireOpen} status="Open violations" statusColor={fireOpen > 0 ? "text-red-600 font-medium" : "text-gray-400"} />
            <StatusCard icon="⚡" label="Elevator" value={elevatorViolations.length} status={elevatorActive > 0 ? `${elevatorActive} active` : "None active"} statusColor={elevatorActive > 0 ? "text-red-600 font-medium" : "text-gray-400"} />
          </div>
        </section>

        {/* ─── 3. Construction Activity ─── */}
        <section className="mb-8 no-break">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Construction Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard label="Status" value={constructionLevel} sub={constructionLevel !== "None" ? durationStr : undefined} />
            <InfoCard label="Active Permits" value={countActive} />
            <InfoCard label="Work Types" value={workTypes.length > 0 ? workTypes.join(", ") : "None"} />
            <InfoCard label="Duration" value={constructionLevel !== "None" ? durationStr : "—"} />
          </div>
        </section>

        {/* ─── 4. Complaint History ─── */}
        <section className="mb-8 no-break">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Complaint History</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoCard label="Total Complaints" value={data.total_complaints || complaints.length} />
          </div>
        </section>

        {/* ─── 5. Landlord Track Record ─── */}
        <section className="mb-8 no-break">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Landlord Track Record</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard label="Owner" value={b.owner_name || "—"} />
            <InfoCard label="ECB Penalties" value={fmt$(totalEcbPenalties)} />
            <InfoCard label="HPD Litigations" value={litigations.length} sub={openLit.length > 0 ? `${openLit.length} open` : "None open"} />
            <InfoCard label="Judgements" value={judgements} />
          </div>
        </section>

        {/* ─── 6. Apartment Details ─── */}
        {apt && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Apartment {apt} Details</h2>
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                <strong>{aptViolations.length} violation{aptViolations.length !== 1 ? "s" : ""}</strong> found for apartment {apt} ({aptOpenViolations.length} currently open).
                {aptPermits.length > 0 && <> <strong>{aptPermits.length} permit{aptPermits.length !== 1 ? "s" : ""}</strong> mention this apartment.</>}
              </p>
            </div>

            {aptViolations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-300">
                      <th className="pb-2 pr-3 font-medium">Class</th>
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aptViolations.map((v: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v.class === "C" ? "bg-red-100 text-red-700" : v.class === "B" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>{v.class}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs">{fmtDate(v.inspectiondate)}</td>
                        <td className="py-2 pr-3 text-xs">{v.violationstatus}</td>
                        <td className="py-2 text-xs text-gray-600">{v.novdescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ─── 7. Footer ─── */}
        <footer className="mt-12 pt-6 border-t-2 border-gray-200 text-sm text-gray-400 no-break">
          <p>Data sourced from NYC Open Data. Report generated {generatedDate} via Wocket.</p>
          <p className="mt-1">This report is for informational purposes only. Verify all data independently before making housing decisions.</p>
        </footer>
      </div>
    </div>
  );
}

export default function RentersReportPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-white"><div className="text-gray-400 text-lg">Loading...</div></div>}>
      <RentersReportPage />
    </Suspense>
  );
}
