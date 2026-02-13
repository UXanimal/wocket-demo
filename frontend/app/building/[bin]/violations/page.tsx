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
      { code: "A", label: "Non-hazardous — minor condition (e.g., peeling paint in small area, missing outlet cover)", color: "bg-gray-100 text-gray-700" },
      { code: "B", label: "Hazardous — condition endangering comfort/safety (e.g., leaky faucet, inadequate lighting)", color: "bg-orange-100 text-orange-700" },
      { code: "C", label: "Immediately hazardous — serious threat to life/safety (e.g., lead paint, no heat/hot water, fire escape blocked, vermin)", color: "bg-red-100 text-red-700" },
    ],
  },
  {
    title: "Violation Status",
    entries: [
      { code: "Open", label: "Violation has not been corrected or certified as corrected", color: "text-red-500" },
      { code: "Close", label: "Violation has been corrected and certified by HPD inspection", color: "text-gray-400" },
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
      <ListPage
        title="HPD Violations"
        apiPath="violations/all"
        defaultSort="severity"
        searchPlaceholder="Search violations (e.g. lead, mold, fire)..."
        columns={[
          { key: "class", label: "Class", render: (r) => (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              r.class === "C" ? "bg-red-100 text-red-700" : r.class === "B" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
            }`}>{r.class}</span>
          )},
          { key: "apartment", label: "Apt" },
          { key: "inspectiondate", label: "Date", render: (r) => formatDate(r.inspectiondate) },
          { key: "days_open", label: "Open", render: (r) => {
            if (r.violationstatus !== "Open" || !r.inspectiondate) return <span className="text-gray-400">—</span>;
            const days = Math.floor((Date.now() - new Date(r.inspectiondate).getTime()) / 86400000);
            if (days <= 0) return <span className="text-gray-400">—</span>;
            const text = days > 365 ? `${Math.floor(days/365)}y ${days%365}d` : `${days}d`;
            const color = days > 365 ? "text-red-600 font-medium" : days > 90 ? "text-orange-500" : "text-gray-600";
            return <span className={color}>{text}</span>;
          }},
          { key: "violationstatus", label: "Status", render: (r) => (
            <span className={r.violationstatus === "Open" ? "text-red-600 font-medium" : "text-gray-500"}>{r.violationstatus}</span>
          )},
          { key: "currentstatus", label: "Current Status" },
          { key: "novdescription", label: "Description", className: "max-w-xs truncate" },
        ]}
        filters={[
          { key: "class", label: "Class", options: [
            { value: "C", label: "C — Immediately Hazardous", color: "bg-red-100 text-red-700" },
            { value: "B", label: "B — Hazardous", color: "bg-orange-100 text-orange-700" },
            { value: "A", label: "A — Non-Hazardous", color: "bg-gray-100 text-gray-700" },
          ]},
          { key: "status", label: "Status", options: [
            { value: "Open", label: "Open", color: "bg-red-100 text-red-700" },
            { value: "Close", label: "Closed" },
          ]},
        ]}
        onRowClick={handleRowClick}
        selectedIndex={selectedIdx}
        glossary={HPD_GLOSSARY}
        rowHighlight={(r) => r.is_unit_match ? "bg-blue-50 border-l-4 border-l-blue-500" : r.is_floor_match ? "bg-blue-50/40 border-l-4 border-l-blue-200" : ""}
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
        ] : []}
      />
    </>
  );
}

export default function ViolationsPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading...</div></div>}><ViolationsPageInner /></Suspense>;
}
