"use client";
import { useEffect, useCallback } from "react";

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function fmt$(v: any) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  title: string;
  subtitle?: string;
  externalUrl?: string;
  externalLabel?: string;
  source?: string;
  fields: { label: string; value: any; full?: boolean }[];
  preFooter?: React.ReactNode;
}

export default function DetailDrawer({ open, onClose, onPrev, onNext, title, subtitle, externalUrl, externalLabel, source, fields, preFooter }: DetailDrawerProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowUp" && onPrev) { e.preventDefault(); onPrev(); }
    if (e.key === "ArrowDown" && onNext) { e.preventDefault(); onNext(); }
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Drawer */}
      <div className="relative w-full max-w-lg md:max-w-xl bg-white dark:bg-[#1a1b2e] shadow-2xl dark:shadow-none overflow-y-auto animate-slide-in-right max-md:max-w-full max-md:rounded-t-2xl max-md:mt-16">
        <div className="sticky top-0 bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 min-w-0">
            {(onPrev || onNext) && (
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={onPrev} disabled={!onPrev} className={`text-sm md:text-xs px-2.5 py-1.5 md:px-1.5 md:py-0.5 rounded ${onPrev ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200' : 'text-gray-200 dark:text-gray-700'}`}>▲</button>
                <button onClick={onNext} disabled={!onNext} className={`text-sm md:text-xs px-2.5 py-1.5 md:px-1.5 md:py-0.5 rounded ${onNext ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200' : 'text-gray-200 dark:text-gray-700'}`}>▼</button>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold font-nunito text-gray-900 dark:text-gray-100 truncate">{title}</h2>
              {subtitle && <div className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none shrink-0 ml-2">×</button>
        </div>
        <div className="px-4 md:px-6 py-4 space-y-3">
          {fields.map((f, i) => (
            <div key={i} className={f.full ? "col-span-2" : ""}>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{f.label}</div>
              <div className={`text-sm text-gray-900 dark:text-gray-100 mt-0.5 ${f.full ? "whitespace-pre-wrap" : ""}`}>
                {f.value ?? "—"}
              </div>
            </div>
          ))}
        </div>
        {preFooter}
        <div className="px-4 md:px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap">
          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              {externalLabel || "View on BISweb"} ↗
            </a>
          )}
          {source && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Source: {source}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export { formatDate, fmt$ };
