"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BuildingSafetySummaryProps {
  data: any;
}

function percentileLabel(pct: number): string | null {
  if (pct >= 90) return `Worse than ${pct}% of NYC buildings`;
  if (pct >= 75) return `More than ${pct}% of NYC buildings`;
  if (pct >= 50) return "Above average for NYC buildings";
  return null;
}

export default function BuildingSafetySummary({ data }: BuildingSafetySummaryProps) {
  const b = data.building;
  const [percentiles, setPercentiles] = useState<any>({});
  const [violationAges, setViolationAges] = useState<any>({});
  const [cityAvgAges, setCityAvgAges] = useState<any>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://wocket-demo-production-adad.up.railway.app'}/api/building/${b.bin}/percentiles`)
      .then(r => r.json())
      .then(d => {
        setPercentiles(d.percentiles || {});
        setViolationAges(d.open_violation_ages || {});
        setCityAvgAges(d.city_avg_violation_ages || {});
      })
      .catch(() => {});
  }, [b.bin]);

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

  const hasAnything = tcoExpired || openClassC > 0 || activeSafety > 0 || vacateStopWork > 0 ||
    openClassB > 0 || ecbPenalties > 0 || activeLitigation > 0 || unsignedJobs > 0 || totalComplaints > 50;

  if (!hasAnything) {
    return (
      <div className="mt-6 mb-6 flex items-center gap-2">
        <span className="text-lg">✅</span>
        <span className="text-sm font-medium text-green-700 dark:text-green-300">No open issues found in city records.</span>
      </div>
    );
  }

  // Each tile now has an optional percentileKey to look up comparative context
  const bin = b.bin;
  const tiles: { value: string; label: string; sublabel: string; color: string; percentileKey?: string; href?: string }[] = [];

  if (tcoExpired) {
    tiles.push({
      value: tcoYearsOverdue ? `${tcoYearsOverdue}yr` : "Expired",
      label: "No Valid C of O",
      sublabel: "Operating on expired TCO — violates MDL §301",
      color: "bg-[#e4d5d8] dark:bg-[#3d2630]/50 text-[#5e3345] dark:text-[#c49aaa]",
      href: "/explore/expired-tcos",
    });
  }
  if (openClassC > 0) {
    const cAge = violationAges["C"];
    const cCity = cityAvgAges["C"];
    let cAgeSublabel = "Immediately hazardous — 24hr correction";
    if (cAge?.avg_days) {
      const months = Math.round(cAge.avg_days / 30);
      cAgeSublabel += ` · Open avg ${months > 0 ? months + " months" : cAge.avg_days + " days"}`;
      if (cCity && cAge.avg_days < cCity) {
        cAgeSublabel += ` (city avg: ${Math.round(cCity / 30)} mo)`;
      }
    }
    tiles.push({
      value: String(openClassC),
      label: "Open Class C",
      sublabel: cAgeSublabel,
      color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
      percentileKey: "class_c",
      href: `/building/${bin}/violations?class=C&sort=severity&order=desc`,
    });
  }
  if (activeSafety > 0) {
    tiles.push({
      value: String(activeSafety),
      label: "DOB Safety Violations",
      sublabel: "Elevators, boilers, fire safety",
      color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    });
  }
  if (vacateStopWork > 0) {
    tiles.push({
      value: String(vacateStopWork),
      label: "Vacate / Stop Work",
      sublabel: "Active orders on record",
      color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
      href: `/building/${bin}/complaints?status=ACTIVE`,
    });
  }
  if (openClassB > 0) {
    const bAge = violationAges["B"];
    const bCity = cityAvgAges["B"];
    let bAgeSublabel = "Hazardous — 30-day correction";
    if (bAge?.avg_days) {
      const months = Math.round(bAge.avg_days / 30);
      bAgeSublabel += ` · Open avg ${months > 0 ? months + " months" : bAge.avg_days + " days"}`;
      if (bCity && bAge.avg_days < bCity) {
        bAgeSublabel += ` (city avg: ${Math.round(bCity / 30)} mo)`;
      }
    }
    tiles.push({
      value: String(openClassB),
      label: "Open Class B",
      sublabel: bAgeSublabel,
      color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
      href: `/building/${bin}/violations?class=B&sort=severity&order=desc`,
    });
  }
  if (ecbPenalties > 0) {
    tiles.push({
      value: `$${ecbPenalties.toLocaleString()}`,
      label: "ECB Penalties",
      sublabel: "Environmental Control Board fines",
      color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
      percentileKey: "ecb_penalties",
    });
  }
  if (activeLitigation > 0) {
    tiles.push({
      value: String(activeLitigation),
      label: "HPD Litigations",
      sublabel: "Active cases against owner",
      color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    });
  }
  if (unsignedJobs > 0) {
    tiles.push({
      value: String(unsignedJobs),
      label: "Unsigned Alt. Jobs",
      sublabel: "No final sign-off from DOB",
      color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
      href: `/building/${bin}/permits`,
    });
  }
  if (totalComplaints > 50) {
    tiles.push({
      value: totalComplaints.toLocaleString(),
      label: "DOB Complaints",
      sublabel: "Total complaints on record",
      color: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200",
      percentileKey: "complaints",
      href: `/building/${bin}/complaints`,
    });
  }

  return (
    <div className="mt-6 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">At a Glance</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((t, i) => {
          const pct = t.percentileKey ? percentiles[t.percentileKey] : undefined;
          const pctLabel = pct !== undefined ? percentileLabel(pct) : null;
          const isSevere = pct !== undefined && pct >= 90;

          const bgClasses = t.color.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("dark:bg-")).join(" ");
          const textClasses = t.color.split(" ").filter(c => c.startsWith("text-") || c.startsWith("dark:text-")).join(" ");
          const content = (
            <>
              <div className={`text-xl font-bold font-nunito ${textClasses}`}>{t.value}</div>
              <div className={`text-xs font-medium mt-0.5 ${textClasses}`}>{t.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.sublabel}</div>
              {pctLabel && (
                <div className={`text-xs mt-1 ${isSevere ? "font-semibold text-red-700 dark:text-red-300" : "font-medium text-gray-600 dark:text-gray-300"}`}>
                  {pctLabel}
                </div>
              )}
            </>
          );

          return t.href ? (
            <Link key={i} href={t.href} className={`rounded-lg px-3 py-2.5 ${bgClasses} hover:opacity-80 transition-opacity cursor-pointer block`}>
              {content}
            </Link>
          ) : (
            <div key={i} className={`rounded-lg px-3 py-2.5 ${bgClasses}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
