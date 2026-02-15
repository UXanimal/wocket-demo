"use client";
import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import ListPage from "../../../components/ListPage";
import type { GlossarySection } from "../../../components/ListPage";
import DetailDrawer, { formatDate, fmt$ } from "../../../components/DetailDrawer";

const ECB_GLOSSARY: GlossarySection[] = [
  {
    title: "Severity Levels",
    entries: [
      { code: "Unknown", label: "Severity not classified" },
      { code: "Non-Hazardous", label: "Minor violations — no immediate danger" },
      { code: "Hazardous", label: "Conditions that endanger safety or welfare" },
      { code: "Imm. Hazardous", label: "Immediately hazardous — serious threat to life/safety" },
    ],
  },
  {
    title: "Violation Status",
    entries: [
      { code: "DEFAULT", label: "Respondent failed to appear at hearing — penalty imposed automatically", color: "text-red-500" },
      { code: "RESOLVE", label: "Violation resolved — penalty paid or condition corrected", color: "text-gray-400 dark:text-gray-500" },
      { code: "PENDING", label: "Case is pending hearing or resolution", color: "text-yellow-400" },
      { code: "DISMISSED", label: "Violation was dismissed at hearing", color: "text-gray-400 dark:text-gray-500" },
    ],
  },
  {
    title: "Hearing Status",
    entries: [
      { code: "DEFAULT", label: "Respondent did not appear — decision entered by default" },
      { code: "RESOLVE", label: "Case resolved at or after hearing" },
      { code: "WRITTEN OFF", label: "Penalty deemed uncollectable — written off" },
    ],
  },
  {
    title: "Common Infraction Codes",
    entries: [
      { code: "Unknown", label: "Not specified" },
      { code: "28-105.1", label: "Work without permit (NYC Building Code)" },
      { code: "28-118.3.2", label: "Occupied without valid Certificate of Occupancy" },
      { code: "28-204.1", label: "Failure to comply with DOB order" },
      { code: "28-210.1", label: "Illegal conversion of building use" },
      { code: "28-301.1", label: "Failure to maintain building in safe condition" },
    ],
  },
];

function EcbPageInner() {
  const { bin } = useParams() as { bin: string };
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [currentData, setCurrentData] = useState<any[]>([]);
  const selected = selectedIdx >= 0 ? currentData[selectedIdx] : null;

  const handleRowClick = useCallback((row: any, index: number, allData: any[]) => {
    setCurrentData(allData);
    setSelectedIdx(index);
  }, []);

  const onPrev = selectedIdx > 0 ? () => setSelectedIdx(selectedIdx - 1) : undefined;
  const onNext = selectedIdx < currentData.length - 1 ? () => setSelectedIdx(selectedIdx + 1) : undefined;

  return (
    <>
      <ListPage
        title="DOB/ECB Violations"
        apiPath="ecb/all"
        defaultSort="issue_date"
        searchPlaceholder="Search descriptions (e.g. fire stopping, asbestos, C of O, scaffold)..."
        columns={[
          { key: "severity", label: "Severity", render: (r) => {
            const s = String(r.severity || "");
            if (s.includes("1")) return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Class 1</span>;
            if (s === "Hazardous" || s.includes("2")) return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">{s.includes("2") ? "Class 2" : "Hazardous"}</span>;
            if (s === "Non-Hazardous" || s.includes("3")) return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{s.includes("3") ? "Class 3" : "Non-Hazardous"}</span>;
            return <span className="text-xs text-gray-400 dark:text-gray-500">{r.severity || "—"}</span>;
          }},
          { key: "issue_date", label: "Issue Date", render: (r) => formatDate(r.issue_date) },
          { key: "ecb_violation_status", label: "Status", render: (r) => {
            const s = r.ecb_violation_status;
            if (s === "ACTIVE") return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">ACTIVE</span>;
            if (s === "RESOLVE") return <span className="text-gray-500 dark:text-gray-400">RESOLVED</span>;
            return <span className="text-gray-400 dark:text-gray-500">{s || "—"}</span>;
          }},
          { key: "violation_description", label: "Description", render: (r) => (
            <div className="max-w-xs">
              <div className="truncate">{r.violation_description || "—"}</div>
              {((r.tags || []).length > 0 || (r.extracted_apartments || []).length > 0) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(r.tags || []).map((t: any, i: number) => {
                    const highSev = ["fire-stopping", "asbestos", "lead", "structural", "egress"].includes(t.id);
                    return <span key={i} className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${highSev ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"}`}>{t.icon} {t.label}</span>;
                  })}
                  {(r.extracted_apartments || []).length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">🏠 {r.extracted_apartments.join(", ")}</span>
                  )}
                </div>
              )}
            </div>
          )},
          { key: "penality_imposed", label: "Penalty", render: (r) => fmt$(r.penality_imposed) },
          { key: "balance_due", label: "Balance", render: (r) => r.balance_due > 0 ? <span className="text-red-600 font-medium">{fmt$(r.balance_due)}</span> : fmt$(r.balance_due) },
        ]}
        filters={[
          { key: "severity", label: "Severity", options: [
            { value: "CLASS - 1", label: "Class 1 — Immediately Hazardous", color: "bg-red-100 text-red-700" },
            { value: "CLASS - 2", label: "Class 2 — Major", color: "bg-orange-100 text-orange-700" },
            { value: "Hazardous", label: "Hazardous", color: "bg-orange-100 text-orange-700" },
            { value: "Non-Hazardous", label: "Non-Hazardous", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" },
            { value: "CLASS - 3", label: "Class 3 — Minor", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" },
          ]},
          { key: "status", label: "Status", options: [
            { value: "ACTIVE", label: "Active", color: "bg-red-100 text-red-700" },
            { value: "RESOLVE", label: "Resolved" },
          ]},
          { key: "has_balance", label: "Balance", options: [
            { value: "true", label: "Has Balance Due", color: "bg-red-100 text-red-700" }
          ]},
        ]}
        onRowClick={handleRowClick}
        selectedIndex={selectedIdx}
        glossary={ECB_GLOSSARY}
        rowHighlight={(r) => r.is_unit_match ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500" : r.ecb_violation_status === "ACTIVE" ? "bg-red-50/40" : ""}
      />
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedIdx(-1)}
        onPrev={onPrev}
        onNext={onNext}
        title={`ECB ${selected?.ecb_violation_number || ""}`}
        subtitle={selectedIdx >= 0 ? `${selectedIdx + 1} of ${currentData.length}` : undefined}
        externalUrl={`https://a810-bisweb.nyc.gov/bisweb/ECBQueryByLocationServlet?requestid=0&allbin=${bin}`}
        source="NYC Open Data · DOB/ECB Violations"
          fields={selected ? [
          { label: "ECB Violation Number", value: selected.ecb_violation_number },
          { label: "Severity", value: selected.severity },
          { label: "Issue Date", value: formatDate(selected.issue_date) },
          { label: "Served Date", value: formatDate(selected.served_date) },
          { label: "Status", value: selected.ecb_violation_status },
          { label: "Violation Type", value: selected.violation_type },
          { label: "Penalty Imposed", value: fmt$(selected.penality_imposed) },
          { label: "Amount Paid", value: fmt$(selected.amount_paid) },
          { label: "Balance Due", value: fmt$(selected.balance_due) },
          { label: "Respondent", value: selected.respondent_name },
          { label: "Hearing Date", value: formatDate(selected.hearing_date) },
          { label: "Hearing Status", value: selected.hearing_status },
          { label: "Certification Status", value: selected.certification_status },
          { label: "Infraction Code", value: selected.infraction_code1 },
          { label: "Section/Law", value: selected.section_law_description1 },
          { label: "Description", value: selected.violation_description, full: true },
          ...(selected.tags && selected.tags.length > 0 ? [{ label: "Hazard Tags", value: (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {selected.tags.map((t: any, ti: number) => {
                const highSev = ["fire-stopping", "asbestos", "lead", "structural", "egress"].includes(t.id);
                return (
                  <span key={ti} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${highSev ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"}`}>
                    {t.icon} {t.label}
                  </span>
                );
              })}
            </div>
          ), full: true }] : []),
          ...(selected.extracted_apartments && selected.extracted_apartments.length > 0 ? [{ label: "Apartments Mentioned", value: (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {selected.extracted_apartments.map((apt: string, ai: number) => (
                <span key={ai} className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  🏠 {apt}
                </span>
              ))}
            </div>
          ) }] : []),
        ] : []}
      />
    </>
  );
}

export default function EcbPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500">Loading...</div></div>}><EcbPageInner /></Suspense>;
}
