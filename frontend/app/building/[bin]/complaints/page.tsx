"use client";
import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { redactSlurs } from "../../../utils/redact";
import ListPage from "../../../components/ListPage";
import type { GlossarySection } from "../../../components/ListPage";
import DetailDrawer, { formatDate } from "../../../components/DetailDrawer";

const COMPLAINTS_GLOSSARY: GlossarySection[] = [
  {
    title: "Complaint Categories",
    entries: [
      { code: "01", label: "Accident - Construction/Plumbing" },
      { code: "02", label: "Adjacent Buildings - Not Protected" },
      { code: "03", label: "Boiler" },
      { code: "04", label: "Building - Loss of Use/Vacate" },
      { code: "05", label: "Building Condition - Dangerous" },
      { code: "06", label: "Building Shaking/Vibrating/Structural Damage" },
      { code: "09", label: "Elevator" },
      { code: "12", label: "Illegal Conversion" },
      { code: "13", label: "Illegal Work/No Permit" },
      { code: "14", label: "Plumbing - Defective/Leaking" },
      { code: "15", label: "Crane Safety" },
      { code: "16", label: "Safety Net/Guardrail/Sidewalk Shed" },
      { code: "18", label: "Illegal Conversion Commercial" },
      { code: "20", label: "Construction Safety" },
      { code: "23", label: "Demolition" },
      { code: "24", label: "General Construction/Plumbing" },
      { code: "27", label: "Sign/Billboard/Neon" },
      { code: "29", label: "Excavation/Foundation" },
      { code: "31", label: "Certificate of Occupancy - None/Illegal" },
      { code: "45", label: "Failure to Maintain" },
      { code: "46", label: "Work Without Permit" },
      { code: "4A", label: "Illegal Curb Cut" },
      { code: "4B", label: "Electrical Wiring Defective" },
      { code: "4E", label: "Building Vacant/Open/Unguarded" },
      { code: "4F", label: "Scaffolding" },
      { code: "4G", label: "Structural Stability" },
      { code: "4H", label: "Construction Safety - Other" },
      { code: "4K", label: "Sidewalk Shed/Fence - Inadequate" },
      { code: "4N", label: "After Hours Work" },
      { code: "59", label: "Working Without Safety Devices" },
      { code: "71", label: "SRO - Illegal Work/Occupancy Change" },
      { code: "75", label: "Non-Compliance with Vacate Order" },
      { code: "81", label: "Noise - Loss of Use" },
      { code: "83", label: "Illegal Conversion - Residential" },
      { code: "85", label: "Gas/Fire-Stop Work" },
      { code: "91", label: "C of O - None/Expired" },
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
            <span><span className="font-mono text-gray-400 dark:text-gray-500 mr-1">{r.complaint_category}</span>{r.category_description || ""}</span>
          )},
          { key: "status", label: "Status", render: (r) => (
            <span className={r.status === "ACTIVE" ? "text-red-600 font-medium" : "text-gray-500 dark:text-gray-400"}>{r.status}</span>
          )},
          { key: "disposition_description", label: "Disposition", render: (r) => (
            <span>{r.disposition_code ? <span className="font-mono text-gray-400 dark:text-gray-500 mr-1">{r.disposition_code}</span> : null}{r.disposition_description || r.disposition_code || "—"}</span>
          )},
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
          { label: "Category", value: `${selected.complaint_category} — ${selected.bisweb?.category_full || selected.category_description || "Unknown"}` },
          ...(selected.bisweb?.description ? [{ label: "Re", value: redactSlurs(selected.bisweb.description), full: true }] : []),
          { label: "Unit", value: selected.unit },
          ...(selected.bisweb?.assigned_to ? [{ label: "Assigned To", value: selected.bisweb.assigned_to }] : []),
          ...(selected.bisweb?.priority ? [{ label: "Priority", value: selected.bisweb.priority }] : []),
          { label: "Disposition", value: selected.disposition_code ? `${selected.disposition_code} — ${selected.bisweb?.disposition_text || selected.disposition_description || "Unknown"}` : "—" },
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
