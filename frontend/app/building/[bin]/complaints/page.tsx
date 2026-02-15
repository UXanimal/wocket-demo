"use client";
import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { redactSlurs } from "../../../utils/redact";
import ListPage from "../../../components/ListPage";
import type { GlossarySection } from "../../../components/ListPage";
import DetailDrawer, { formatDate } from "../../../components/DetailDrawer";

const COMPLAINTS_GLOSSARY: GlossarySection[] = [
  {
    title: "Safety & Structural",
    entries: [
      { code: "05", label: "Permit - None (Building/PA/Demo etc.)" },
      { code: "28", label: "Building - In Danger of Collapse" },
      { code: "29", label: "Building - Vacant, Open and Unguarded" },
      { code: "30", label: "Building Shaking/Vibrating/Struct Stability Affected" },
      { code: "37", label: "Egress - Locked/Blocked/Improper/No Secondary Means" },
      { code: "40", label: "Falling - Part of Building" },
      { code: "41", label: "Falling - Part of Building in Danger of" },
      { code: "43", label: "Structural Stability Affected" },
      { code: "54", label: "Wall/Retaining Wall - Bulging/Cracked" },
      { code: "73", label: "Failure to Maintain" },
    ],
  },
  {
    title: "Elevator",
    entries: [
      { code: "62", label: "Elevator - Danger Condition/Shaft Open/Unguarded" },
      { code: "63", label: "Elevator - Defective/Inoperative" },
      { code: "64", label: "Elevator Shaft - Open and Unguarded" },
      { code: "6M", label: "Elevator - Multiple Devices on Property" },
      { code: "6S", label: "Elevator - Single Device/No Alternate Service" },
      { code: "80", label: "Elevator Not Inspected/Illegal/No Permit" },
      { code: "81", label: "Elevator - Accident" },
    ],
  },
  {
    title: "Electrical & Plumbing",
    entries: [
      { code: "3A", label: "Unlicensed/Illegal/Improper Electrical Work In Progress" },
      { code: "59", label: "Electrical Wiring - Defective/Exposed/In Progress" },
      { code: "60", label: "Electrical Work - Improper" },
      { code: "61", label: "Electrical Work - Unlicensed, In Progress" },
      { code: "65", label: "Gas Hook-Up/Piping - Illegal or Defective" },
      { code: "66", label: "Plumbing Work - Illegal/No Permit (Sprinkler/Standpipe)" },
      { code: "76", label: "Unlicensed/Illegal/Improper Plumbing Work In Progress" },
      { code: "94", label: "Plumbing - Defective/Leaking/Not Maintained" },
    ],
  },
  {
    title: "Construction & Permits",
    entries: [
      { code: "04", label: "After Hours Work - Illegal" },
      { code: "11", label: "Demolition - No Permit" },
      { code: "13", label: "Elevator In (FDNY) Readiness - None" },
      { code: "46", label: "PA Permit - None" },
      { code: "5G", label: "Unlicensed/Illegal/Improper Work In Progress" },
      { code: "7J", label: "Work Without a Permit - Occupied Multiple Dwelling" },
      { code: "83", label: "Construction - Contrary/Beyond Approved Plans/Permits" },
      { code: "86", label: "Work Contrary to Stop Work Order" },
    ],
  },
  {
    title: "Illegal Use & Conversion",
    entries: [
      { code: "1A", label: "Illegal Conversion Commercial to Dwelling" },
      { code: "12", label: "Demolition - Unsafe/Illegal/Mechanical Demo" },
      { code: "31", label: "Certificate of Occupancy - None/Illegal/Contrary to CO" },
      { code: "45", label: "Illegal Conversion" },
      { code: "48", label: "Residential Use - Illegal" },
      { code: "71", label: "SRO - Illegal Work/No Permit/Change in Occupancy" },
      { code: "92", label: "Illegal Conversion of Manufacturing/Industrial Space" },
    ],
  },
  {
    title: "Fire & Boiler",
    entries: [
      { code: "52", label: "Sprinkler System - Inadequate" },
      { code: "56", label: "Boiler - Fumes/Smoke/Carbon Monoxide" },
      { code: "57", label: "Boiler - Illegal" },
      { code: "58", label: "Boiler - Defective/Inoperative/No Permit" },
      { code: "82", label: "Boiler - Accident/Explosion" },
      { code: "85", label: "Failure to Retain Water/Improper Drainage (LL103/89)" },
    ],
  },
  {
    title: "Facade",
    entries: [
      { code: "10", label: "Debris/Building - Falling or In Danger of Falling" },
      { code: "2L", label: "Facade (LL11/98) - Unsafe Notification" },
      { code: "84", label: "Facade - Defective/Cracking" },
    ],
  },
  {
    title: "Disposition Codes",
    entries: [
      { code: "A1", label: "Violation Issued", color: "text-red-500" },
      { code: "A2", label: "Warning Issued", color: "text-orange-400" },
      { code: "A3", label: "Partial Stop Work Order", color: "text-red-400" },
      { code: "A4", label: "Full Stop Work Order", color: "text-red-500" },
      { code: "A5", label: "Vacate Order", color: "text-red-600" },
      { code: "A6", label: "Unsafe Building", color: "text-red-600" },
      { code: "A8", label: "Referred", color: "text-yellow-400" },
      { code: "A9", label: "No Action Necessary", color: "text-gray-400 dark:text-gray-500" },
      { code: "I1", label: "No Access", color: "text-gray-400 dark:text-gray-500" },
      { code: "I2", label: "Unable to Locate", color: "text-gray-400 dark:text-gray-500" },
    ],
  },
];

function ComplaintsPageInner() {
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
        title="DOB Complaints"
        apiPath="complaints/all"
        defaultSort="date_entered"
        searchPlaceholder="Search by keyword (e.g. elevator, asbestos, TCO, boiler, permit)..."
        columns={[
          { key: "date_entered", label: "Date Filed" },
          { key: "category_description", label: "Category", render: (r) => (
            <span><span className="font-mono text-gray-400 dark:text-gray-500 mr-1">{r.complaint_category}</span>{r.category_description && r.category_description !== r.complaint_category ? r.category_description : ""}</span>
          )},
          { key: "status", label: "Status", render: (r) => (
            <span className={r.status === "ACTIVE" ? "text-red-600 font-medium" : "text-gray-500 dark:text-gray-400"}>{r.status}</span>
          )},
          { key: "disposition_description", label: "Disposition", render: (r) => (
            <span>{r.disposition_code ? <span className="font-mono text-gray-400 dark:text-gray-500 mr-1">{r.disposition_code}</span> : null}{r.disposition_description && r.disposition_description !== r.disposition_code ? r.disposition_description : ""}</span>
          )},
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
          { key: "inspection_date", label: "Inspected" },
        ]}
        filters={[
          { key: "status", label: "Status", options: [
            { value: "ACTIVE", label: "Active" }, { value: "CLOSED", label: "Closed" }
          ]},
        ]}
        onRowClick={handleRowClick}
        selectedIndex={selectedIdx}
        glossary={COMPLAINTS_GLOSSARY}
      />
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedIdx(-1)}
        onPrev={onPrev}
        onNext={onNext}
        title={`Complaint ${selected?.complaint_number || ""}`}
        subtitle={selectedIdx >= 0 ? `${selectedIdx + 1} of ${currentData.length}` : undefined}
        externalUrl={`https://a810-bisweb.nyc.gov/bisweb/ComplaintsByAddressServlet?requestid=0&allbin=${bin}`}
        source={selected?.bisweb ? "NYC Open Data + BISweb" : "NYC Open Data · DOB Complaints"}
          fields={selected ? [
          { label: "Complaint #", value: selected.complaint_number },
          { label: "Date Filed", value: selected.date_entered },
          { label: "Status", value: selected.status },
          { label: "Category", value: selected.bisweb?.category_full || (selected.category_description && selected.category_description !== selected.complaint_category ? `${selected.complaint_category} — ${selected.category_description}` : selected.complaint_category) },
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
          ...(selected.bisweb?.description ? [{ label: "Re", value: redactSlurs(selected.bisweb.description), full: true }] : []),
          { label: "Unit", value: selected.unit },
          ...(selected.bisweb?.assigned_to ? [{ label: "Assigned To", value: selected.bisweb.assigned_to }] : []),
          ...(selected.bisweb?.priority ? [{ label: "Priority", value: selected.bisweb.priority }] : []),
          { label: "Disposition", value: selected.disposition_code ? (selected.bisweb?.disposition_text || (selected.disposition_description && selected.disposition_description !== selected.disposition_code ? `${selected.disposition_code} — ${selected.disposition_description}` : selected.disposition_code)) : "—" },
          { label: "Disposition Date", value: selected.disposition_date },
          { label: "Inspection Date", value: selected.inspection_date },
          ...(selected.bisweb?.last_inspection_badge ? [{ label: "Inspector Badge #", value: selected.bisweb.last_inspection_badge }] : []),
          ...(selected.bisweb?.comments ? [{ label: "Inspector Comments", value: redactSlurs(selected.bisweb.comments), full: true }] : []),
          ...(selected.bisweb?.ref_311 ? [{ label: "311 Reference", value: selected.bisweb.ref_311 }] : []),
          ...(selected.bisweb?.owner ? [{ label: "Owner", value: selected.bisweb.owner }] : []),
        ] : []}
      />
    </>
  );
}

export default function ComplaintsPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500">Loading...</div></div>}><ComplaintsPageInner /></Suspense>;
}
