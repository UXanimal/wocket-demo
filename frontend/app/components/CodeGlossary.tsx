"use client";
import { useState } from "react";

interface GlossaryEntry {
  code: string;
  label: string;
  color?: string; // tailwind classes for the code badge
}

interface GlossarySection {
  title: string;
  entries: GlossaryEntry[];
}

export default function CodeGlossary({ sections }: { sections: GlossarySection[] }) {
  const [open, setOpen] = useState(false);

  if (!sections || sections.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 px-2 py-1 ml-auto"
        title="Code definitions"
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] font-bold leading-none shrink-0">i</span>
        Codes
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Code Definitions</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-white text-xl leading-none">&times;</button>
            </div>

            {sections.map((section, i) => (
              <div key={i} className={i > 0 ? "mt-5" : ""}>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">{section.title}</h4>
                <div className="space-y-1">
                  {section.entries.map((entry) => (
                    <div key={entry.code} className="flex gap-3 text-sm py-1.5 border-b border-gray-800 last:border-0 items-baseline">
                      <span className={`font-mono shrink-0 min-w-[3.5rem] px-1.5 py-0.5 rounded text-xs font-medium text-center ${entry.color || "text-yellow-400"}`}>{entry.code}</span>
                      <span className="text-gray-300 flex-1">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
