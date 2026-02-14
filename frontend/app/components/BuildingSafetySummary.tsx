"use client";

interface BuildingSafetySummaryProps {
  data: any;
}

export default function BuildingSafetySummary({ data }: BuildingSafetySummaryProps) {
  const b = data.building;
  const flags: { level: "critical" | "concerning" | "context"; emoji: string; text: string }[] = [];

  // 🔴 CRITICAL
  if (b.tco_expired || b.co_status === "TCO") {
    const dateStr = b.latest_tco_date
      ? new Date(b.latest_tco_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const yearsOverdue = b.latest_tco_date
      ? Math.floor((Date.now() - new Date(b.latest_tco_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;
    const suffix = dateStr
      ? `Operating on expired TCO since ${dateStr}${yearsOverdue && yearsOverdue > 0 ? ` (${yearsOverdue} year${yearsOverdue !== 1 ? "s" : ""} overdue)` : ""}`
      : "Operating on expired or temporary Certificate of Occupancy";
    flags.push({ level: "critical", emoji: "🔴", text: suffix });
  }

  if (b.open_class_c > 0) {
    flags.push({ level: "critical", emoji: "🔴", text: `${b.open_class_c} open Class C violations — legally required correction within 24 hours` });
  }

  const activeSafety = (data.safety_violations || []).filter((v: any) => {
    const s = (v.violation_status || "").toLowerCase();
    return !s.includes("resolve") && !s.includes("closed") && !s.includes("dismissed");
  });
  if (activeSafety.length > 0) {
    flags.push({ level: "critical", emoji: "🔴", text: `${activeSafety.length} open DOB safety violations (elevators, boilers, fire safety)` });
  }

  const vacateStopWork = (data.complaints || []).filter((c: any) =>
    ["A4", "A5", "A6"].includes(c.disposition_code)
  );
  if (vacateStopWork.length > 0) {
    flags.push({ level: "critical", emoji: "🔴", text: `${vacateStopWork.length} active vacate/stop work order${vacateStopWork.length !== 1 ? "s" : ""}` });
  }

  // 🟡 CONCERNING
  const openClassB = (data.open_violations || []).filter((v: any) => v.class === "B").length;
  if (openClassB > 0) {
    flags.push({ level: "concerning", emoji: "🟡", text: `${openClassB} open Class B violations — 30-day correction required` });
  }

  if (b.ecb_penalties > 0) {
    flags.push({ level: "concerning", emoji: "🟡", text: `$${Number(b.ecb_penalties).toLocaleString()} in ECB penalties` });
  }

  const activeLitigation = (data.litigations || []).filter((l: any) => {
    const s = (l.case_status || "").toLowerCase();
    return s.includes("open") || s.includes("active");
  });
  if (activeLitigation.length > 0) {
    flags.push({ level: "concerning", emoji: "🟡", text: `${activeLitigation.length} active HPD litigation${activeLitigation.length !== 1 ? "s" : ""}` });
  }

  if (b.unsigned_jobs > 0) {
    flags.push({ level: "concerning", emoji: "🟡", text: `${b.unsigned_jobs} open alteration job${b.unsigned_jobs !== 1 ? "s" : ""} without final sign-off` });
  }

  // ⚪ CONTEXT
  if (data.total_complaints > 50) {
    flags.push({ level: "context", emoji: "⚪", text: `${data.total_complaints.toLocaleString()} DOB complaints on record` });
  }

  if (b.score_grade === "F") {
    flags.push({ level: "context", emoji: "⚪", text: "Rated F by Wocket safety score" });
  }

  const hasCritical = flags.some((f) => f.level === "critical");
  const hasConcerning = flags.some((f) => f.level === "concerning");
  const borderColor = hasCritical ? "border-red-500" : hasConcerning ? "border-yellow-500" : "border-green-500";

  if (flags.length === 0) {
    return (
      <div className={`bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} shadow-sm dark:shadow-none px-4 py-3`}>
        <span className="text-sm text-gray-700 dark:text-gray-200">✅ No critical issues found in city records.</span>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} shadow-sm dark:shadow-none px-4 py-3`}>
      <div className="space-y-1">
        {flags.map((f, i) => (
          <div key={i} className="text-sm text-gray-800 dark:text-gray-200">
            {f.emoji} {f.text}
          </div>
        ))}
      </div>
    </div>
  );
}
