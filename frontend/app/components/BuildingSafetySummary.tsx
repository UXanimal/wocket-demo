"use client";

interface BuildingSafetySummaryProps {
  data: any;
}

export default function BuildingSafetySummary({ data }: BuildingSafetySummaryProps) {
  const b = data.building;

  const tcoExpired = b.tco_expired || b.co_status === "TCO";
  const tcoDate = b.latest_tco_date ? new Date(b.latest_tco_date) : null;
  const tcoYearsOverdue = tcoDate
    ? Math.floor((Date.now() - tcoDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const openClassC = b.open_class_c || 0;
  const openClassB = (data.open_violations || []).filter((v: any) => v.class === "B").length;

  const activeSafety = (data.safety_violations || []).filter((v: any) => {
    const s = (v.violation_status || "").toLowerCase();
    return !s.includes("resolve") && !s.includes("closed") && !s.includes("dismissed");
  }).length;

  const vacateStopWork = (data.complaints || []).filter((c: any) =>
    ["A4", "A5", "A6"].includes(c.disposition_code)
  ).length;

  const ecbPenalties = Number(b.ecb_penalties) || 0;

  const activeLitigation = (data.litigations || []).filter((l: any) => {
    const s = (l.case_status || "").toLowerCase();
    return s.includes("open") || s.includes("active");
  }).length;

  const unsignedJobs = b.unsigned_jobs || 0;
  const totalComplaints = data.total_complaints || 0;

  const hasCritical = tcoExpired || openClassC > 0 || activeSafety > 0 || vacateStopWork > 0;
  const hasConcerning = openClassB > 0 || ecbPenalties > 0 || activeLitigation > 0 || unsignedJobs > 0;
  const hasAnything = hasCritical || hasConcerning || totalComplaints > 50;

  if (!hasAnything) {
    return (
      <div className="mt-6 mb-6 flex items-center gap-2">
        <span className="text-lg">✅</span>
        <span className="text-sm font-medium text-green-700 dark:text-green-300">No critical issues found in city records.</span>
      </div>
    );
  }

  const headerText = hasCritical ? "text-red-700 dark:text-red-300" : hasConcerning ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300";
  const headerLabel = hasCritical ? "Critical Issues Found" : hasConcerning ? "Issues Found" : "Notable Conditions";

  return (
    <div className="mt-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{hasCritical ? "🚨" : hasConcerning ? "⚠️" : "ℹ️"}</span>
        <h3 className={`text-sm font-bold uppercase tracking-wide ${headerText}`}>{headerLabel}</h3>
      </div>

      {/* Stats grid */}
      <div>
        {/* Critical row */}
        {hasCritical && (
          <div className="mb-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tcoExpired && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-red-600 dark:text-red-400">
                    {tcoYearsOverdue ? `${tcoYearsOverdue}yr` : "Expired"}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">TCO Overdue</div>
                </div>
              )}
              {openClassC > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-red-600 dark:text-red-400">{openClassC}</div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">Open Class C</div>
                </div>
              )}
              {activeSafety > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-red-600 dark:text-red-400">{activeSafety}</div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">DOB Safety Violations</div>
                </div>
              )}
              {vacateStopWork > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-red-600 dark:text-red-400">{vacateStopWork}</div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">Vacate / Stop Work</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Concerning row */}
        {hasConcerning && (
          <div className="mb-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {openClassB > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-amber-600 dark:text-amber-400">{openClassB}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Open Class B</div>
                </div>
              )}
              {ecbPenalties > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-amber-600 dark:text-amber-400">${ecbPenalties.toLocaleString()}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">ECB Penalties</div>
                </div>
              )}
              {activeLitigation > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-amber-600 dark:text-amber-400">{activeLitigation}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Active HPD Litigations</div>
                </div>
              )}
              {unsignedJobs > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-nunito text-amber-600 dark:text-amber-400">{unsignedJobs}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Unsigned Alt. Jobs</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Context row */}
        {totalComplaints > 50 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
              <div className="text-xl font-bold font-nunito text-gray-700 dark:text-gray-200">{totalComplaints.toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">DOB Complaints</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
