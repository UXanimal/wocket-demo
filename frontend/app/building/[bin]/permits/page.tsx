"use client";
import { Suspense, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import ListPage from "../../../components/ListPage";
import type { GlossarySection } from "../../../components/ListPage";
import DetailDrawer, { formatDate, fmt$ } from "../../../components/DetailDrawer";
const CompanyDrawer = dynamic(() => import("../../../components/CompanyDrawer"), { ssr: false });

const PERMITS_GLOSSARY: GlossarySection[] = [
  {
    title: "Job Types",
    entries: [
      { code: "A1", label: "Alteration Type 1 — major change to use, egress, or occupancy" },
      { code: "A2", label: "Alteration Type 2 — multiple work types (e.g., plumbing + electrical)" },
      { code: "A3", label: "Alteration Type 3 — single work type, minor alteration" },
      { code: "NB", label: "New Building — new construction" },
      { code: "DM", label: "Demolition — full or partial building demolition" },
      { code: "SG", label: "Sign — new or altered sign/billboard" },
    ],
  },
  {
    title: "Work Types",
    entries: [
      { code: "PL", label: "Plumbing" },
      { code: "SP", label: "Sprinkler" },
      { code: "SD", label: "Standpipe" },
      { code: "MH", label: "Mechanical/HVAC" },
      { code: "BL", label: "Boiler" },
      { code: "FP", label: "Fire Protection/Suppression" },
      { code: "EQ", label: "Construction Equipment" },
      { code: "OT", label: "Other/General Construction" },
      { code: "GC", label: "General Construction" },
      { code: "EL", label: "Electrical" },
      { code: "FN", label: "Foundation" },
      { code: "ST", label: "Structural" },
    ],
  },
  {
    title: "Risk Tiers",
    entries: [
      { code: "Critical", label: "High-risk work (plumbing, gas, sprinklers, structural) — uninspected 2+ years", color: "text-red-600" },
      { code: "High", label: "High-risk work uninspected < 2 years, or any work uninspected 5+ years", color: "text-red-400" },
      { code: "Warning", label: "Non-high-risk work uninspected 1–5 years", color: "text-orange-500" },
      { code: "Low", label: "Uninspected less than 1 year", color: "text-yellow-500" },
      { code: "Clear", label: "Signed off — final inspection completed", color: "text-green-500" },
      { code: "None", label: "No work filings, active permits, or not yet expired", color: "text-gray-400" },
    ],
  },
  {
    title: "Permit Status",
    entries: [
      { code: "ENTIRE", label: "Full permit issued — all work authorized" },
      { code: "INITIAL", label: "Initial/partial permit — limited scope authorized" },
      { code: "RENEWAL", label: "Renewed permit — extended from original filing" },
      { code: "SIGNED OFF", label: "Final inspection passed — work complete and approved" },
    ],
  },
  {
    title: "Filing Status",
    entries: [
      { code: "INITIAL", label: "Application filed — not yet approved" },
      { code: "APPROVED", label: "Plans approved by DOB examiner" },
      { code: "PERMIT ISSUED", label: "Work permit has been issued" },
      { code: "SIGNED OFF", label: "Job signed off — all work complete" },
      { code: "WITHDRAWN", label: "Application withdrawn by applicant" },
    ],
  },
];

function PermitsPageInner() {
  const { bin } = useParams() as { bin: string };
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [currentData, setCurrentData] = useState<any[]>([]);
  const selected = selectedIdx >= 0 ? currentData[selectedIdx] : null;
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");

  const handleRowClick = useCallback((row: any, index: number, allData: any[]) => {
    setCurrentData(allData);
    setSelectedIdx(index);
  }, []);

  const onPrev = selectedIdx > 0 ? () => setSelectedIdx(selectedIdx - 1) : undefined;
  const onNext = selectedIdx < currentData.length - 1 ? () => setSelectedIdx(selectedIdx + 1) : undefined;

  return (
    <>
      <ListPage
        title="Permits & Construction"
        apiPath="permits/all"
        defaultSort="risk"
        searchPlaceholder="Search permits and jobs..."
        columns={[
          { key: "risk_tier", label: "", sortable: false, render: (r) => {
            const tier = r.risk_tier || 'none';
            if (tier === 'critical') return <span className="inline-block w-2 h-2 rounded-full bg-red-600 shrink-0" title="Critical" />;
            if (tier === 'high') return <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" title="High" />;
            if (tier === 'warning') return <span className="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Warning" />;
            if (tier === 'low') return <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 shrink-0" title="Low" />;
            if (tier === 'clear') return <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" title="Signed off" />;
            return <span className="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0" title="None" />;
          }},
          { key: "job", label: "Job #" },
          { key: "job_type", label: "Type" },
          { key: "source", label: "Source", render: (r) => (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.source === "BIS" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}>{r.source}</span>
          )},
          { key: "job_status_descrp", label: "Status" },
          { key: "work_type", label: "Work Type", render: (r) => r.work_type || "—" },
          { key: "latest_action_date", label: "Last Action", render: (r) => formatDate(r.latest_action_date) },
          { key: "no_final_inspection", label: "Inspection", sortable: false, render: (r) => {
            if (r.signed_off) return <span className="text-green-600">✓ Signed off</span>;
            const d = r.latest_action_date || r.issued_date;
            const days = d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;
            const dStr = days && days > 0 ? ` · ${days > 365 ? `${Math.floor(days/365)}y ${days%365}d` : `${days}d`}` : '';
            const dColor = days && days > 365 ? "text-red-600 font-medium" : days && days > 90 ? "text-orange-500 font-medium" : "";
            if (r.no_final_inspection) return <span className={dColor || "text-red-600 font-medium"}>⚠ No final{dStr}</span>;
            if (r.risk_tier === 'active') return <span className="text-yellow-600">Pending{dStr}</span>;
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
          }},
        ]}
        filters={[
          { key: "job_type", label: "Type", options: [
            { value: "A1", label: "A1" }, { value: "A2", label: "A2" }, { value: "A3", label: "A3" },
            { value: "NB", label: "NB" }, { value: "DM", label: "DM" }
          ]},
          { key: "signed_off", label: "Signed Off", options: [
            { value: "yes", label: "Yes" }, { value: "no", label: "No" }
          ]},
          { key: "no_final_inspection", label: "Issues", options: [
            { value: "true", label: "No Final Inspection" }
          ]},
          { key: "risk_tier", label: "Risk", options: [
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "warning", label: "Warning" },
            { value: "low", label: "Low" },
            { value: "clear", label: "Clear" },
          ]},
        ]}
        onRowClick={handleRowClick}
        selectedIndex={selectedIdx}
        glossary={PERMITS_GLOSSARY}
        rowHighlight={(r) => r.is_unit_match ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500" : r.no_final_inspection ? "bg-red-50/30" : ""}
      />
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedIdx(-1)}
        onPrev={onPrev}
        onNext={onNext}
        title={`Job ${selected?.job || ""}`}
        subtitle={selectedIdx >= 0 ? `${selectedIdx + 1} of ${currentData.length}` : undefined}
        externalUrl={`https://a810-bisweb.nyc.gov/bisweb/JobsQueryByLocationServlet?requestid=0&allbin=${bin}`}
        source="NYC Open Data · BIS Job Filings + DOB NOW Permits"
          fields={selected ? [
          { label: "Job Number", value: selected.job },
          { label: "Source", value: selected.source },
          { label: "Job Type", value: selected.job_type },
          { label: "Status", value: selected.job_status_descrp },
          { label: "Latest Action Date", value: formatDate(selected.latest_action_date) },
          { label: "Sign-off Date", value: selected.signoff_date || "—" },
          { label: "No Final Inspection", value: selected.no_final_inspection ? "⚠ Yes" : "No" },
          ...(!selected.signed_off && (selected.latest_action_date || selected.issued_date) ? [{ label: "Uninspected For", value: (() => {
            const days = Math.floor((Date.now() - new Date(selected.latest_action_date || selected.issued_date).getTime()) / 86400000);
            return days > 365 ? `${Math.floor(days/365)} years, ${days%365} days` : `${days} days`;
          })() }] : []),
          { label: "Initial Cost", value: fmt$(selected.initial_cost) },
          { label: "Building Type", value: selected.building_type },
          { label: "Existing Dwelling Units", value: selected.existing_dwelling_units },
          { label: "Proposed Dwelling Units", value: selected.proposed_dwelling_units },
          { label: "Owner", value: [selected.owner_first_name, selected.owner_last_name].filter(Boolean).join(" ") || selected.owner_business_name || "—" },
          { label: "Applicant/Contractor", value: selected.applicant_business_name ? (
            <button
              onClick={() => { setSelectedCompany(selected.applicant_business_name); setCompanyDrawerOpen(true); }}
              className="text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline cursor-pointer text-left"
            >
              {selected.applicant_business_name}
            </button>
          ) : "—" },
          { label: "License #", value: selected.applicant_license || "—" },
          { label: "Floor", value: selected.work_on_floor || "—" },
          { label: "Estimated Cost", value: selected.estimated_job_costs ? `$${Number(selected.estimated_job_costs).toLocaleString()}` : "—" },
          { label: "Description", value: selected.job_description, full: true },
        ] : []}
      />
      <CompanyDrawer
        open={companyDrawerOpen}
        onClose={() => setCompanyDrawerOpen(false)}
        companyName={selectedCompany}
        currentBin={bin}
      />
    </>
  );
}

export default function PermitsPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-gray-400 dark:text-gray-500">Loading...</div></div>}><PermitsPageInner /></Suspense>;
}
