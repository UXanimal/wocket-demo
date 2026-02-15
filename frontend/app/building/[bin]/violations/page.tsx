"use client";
import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import ListPage from "../../../components/ListPage";
import type { GlossarySection } from "../../../components/ListPage";
import DetailDrawer, { formatDate } from "../../../components/DetailDrawer";

const HPD_GLOSSARY: GlossarySection[] = [
  {
    title: "Violation Classes",
    entries: [
      { code: "A", label: "Non-hazardous — minor condition (e.g., peeling paint in small area, missing outlet cover)", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" },
      { code: "B", label: "Hazardous — condition endangering comfort/safety (e.g., leaky faucet, inadequate lighting)", color: "bg-orange-100 text-orange-700" },
      { code: "C", label: "Immediately hazardous — serious threat to life/safety (e.g., lead paint, no heat/hot water, fire escape blocked, vermin)", color: "bg-red-100 text-red-700" },
    ],
  },
  {
    title: "Violation Status",
    entries: [
      { code: "Open", label: "Violation has not been corrected or certified as corrected", color: "text-red-500" },
      { code: "Close", label: "Violation has been corrected and certified by HPD inspection", color: "text-gray-400 dark:text-gray-500" },
    ],
  },
  {
    title: "Current Status Codes",
    entries: [
      { code: "VIOLATION OPEN", label: "Violation remains open — owner has not corrected" },
      { code: "VIOLATION CLOSED", label: "HPD confirmed condition was corrected" },
      { code: "VIOLATION DISMISSED", label: "Violation dismissed (e.g., duplicate, erroneous)" },
      { code: "CIV PENALTY IMPOSED", label: "Civil penalty imposed — owner fined for non-compliance" },
    ],
  },
  {
    title: "NOV Types",
    entries: [
      { code: "NOV", label: "Notice of Violation — standard HPD violation notice" },
      { code: "OMO", label: "Original Mailed Order — order mailed to owner to correct" },
    ],
  },
];

function ViolationsPageInner() {
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
      <p className="text-xs italic text-gray-400 dark:text-gray-500 px-4 md:px-6 pt-3">
        ⚠️ Note: A &lsquo;resolved&rsquo; or &lsquo;closed&rsquo; status means the city closed the case — it does not guarantee the issue was actually corrected.
      </p>
      <ListPage
        title="HPD Violations"
        apiPath="violations/all"
        defaultSort="severity"
        searchPlaceholder="Search violations (e.g. lead, mold, fire)..."
        columns={[
          { key: "class", label: "Class", render: (r) => (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              r.class === "C" ? "bg-red-100 text-red-700" : r.class === "B" ? "bg-orange-100 text-orange-700" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            }`}>{r.class}</span>
          )},
          { key: "apartment", label: "Apt" },
          { key: "inspectiondate", label: "Date", render: (r) => formatDate(r.inspectiondate) },
          { key: "days_open", label: "Open", render: (r) => {
            if (r.violationstatus !== "Open" || !r.inspectiondate) return <span className="text-gray-400 dark:text-gray-500">—</span>;
            const days = Math.floor((Date.now() - new Date(r.inspectiondate).getTime()) / 86400000);
            if (days <= 0) return <span className="text-gray-400 dark:text-gray-500">—</span>;
            const text = days > 365 ? `${Math.floor(days/365)}y ${days%365}d` : `${days}d`;
            const color = days > 365 ? "text-red-600 font-medium" : days > 90 ? "text-orange-500" : "text-gray-600 dark:text-gray-300";
            return <span className={color}>{text}</span>;
          }},
          { key: "violationstatus", label: "Status", render: (r) => (
            <span className={r.violationstatus === "Open" ? "text-red-600 font-medium" : "text-gray-500 dark:text-gray-400"} title={r.violationstatus !== "Open" ? "Case closed by city — not verified fixed" : undefined}>{r.violationstatus}{r.violationstatus !== "Open" ? "†" : ""}</span>
          )},
          { key: "currentstatus", label: "Current Status" },
          { key: "novdescription", label: "Description", className: "max-w-xs truncate" },
          { key: "tags", label: "Tags", render: (r) => {
            const tags = r.tags || [];
            if (!tags.length) return <span className="text-gray-300 dark:text-gray-600">—</span>;
            return (
              <div className="flex flex-wrap gap-1">
                {tags.map((t: any, i: number) => {
                  const highSev = ["fire-stopping", "asbestos", "lead", "structural", "egress"].includes(t.id);
                  return <span key={i} className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${highSev ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"}`}>{t.icon} {t.label}</span>;
                })}
              </div>
            );
          }, sortable: false },
        ]}
        filters={[
          { key: "class", label: "Class", options: [
            { value: "C", label: "C — Immediately Hazardous", color: "bg-red-100 text-red-700" },
            { value: "B", label: "B — Hazardous", color: "bg-orange-100 text-orange-700" },
            { value: "A", label: "A — Non-Hazardous", color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" },
          ]},
          { key: "status", label: "Status", options: [
            { value: "Open", label: "Open", color: "bg-red-100 text-red-700" },
            { value: "Close", label: "Closed" },
          ]},
        ]}
        onRowClick={handleRowClick}
        selectedIndex={selectedIdx}
        glossary={HPD_GLOSSARY}
        rowHighlight={(r) => r.is_unit_match ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500" : r.is_floor_match ? "bg-blue-50/40 border-l-4 border-l-blue-200" : ""}
      />
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedIdx(-1)}
        onPrev={onPrev}
        onNext={onNext}
        title={`Violation ${selected?.violationid || ""}`}
        subtitle={selectedIdx >= 0 ? `${selectedIdx + 1} of ${currentData.length}` : undefined}
        externalUrl={`https://a810-bisweb.nyc.gov/bisweb/ActionsByLocationServlet?requestid=0&allbin=${bin}&allinquirytype=BXS4OCV3&stypeocv3=V`}
        source="NYC Open Data · HPD Violations"
          fields={selected ? [
          { label: "Violation ID", value: selected.violationid },
          { label: "Class", value: selected.class },
          { label: "Apartment", value: selected.apartment || "Building-wide" },
          { label: "Story/Floor", value: selected.story },
          { label: "Inspection Date", value: formatDate(selected.inspectiondate) },
          ...(selected.violationstatus === "Open" && selected.inspectiondate ? [{ label: "Days Open", value: (() => {
            const days = Math.floor((Date.now() - new Date(selected.inspectiondate).getTime()) / 86400000);
            return days > 365 ? `${Math.floor(days/365)} years, ${days%365} days` : `${days} days`;
          })() }] : []),
          { label: "NOV Issued Date", value: formatDate(selected.novissueddate) },
          { label: "Violation Status", value: selected.violationstatus },
          { label: "Current Status", value: selected.currentstatus },
          { label: "NOV Type", value: selected.novtype },
          { label: "Description", value: selected.novdescription, full: true },
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
        ] : []}
      />
    </>
  );
}

export default function ViolationsPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500">Loading...</div></div>}><ViolationsPageInner /></Suspense>;
}
