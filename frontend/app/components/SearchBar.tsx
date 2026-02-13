"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  bin: string;
  address: string;
  display_address: string;
  matched_alias: string | null;
  aliases: string | null;
  borough: string;
  zip: string;
  score_grade: string | null;
  open_class_c: number | null;
}

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apartmentsByBin, setApartmentsByBin] = useState<Record<string, string[]>>({});
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function search(q: string) {
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const searchResults = data.results || [];
        setResults(searchResults);
        setShowDropdown(true);
        
        // Fetch apartments for all results in parallel
        const aptPromises = searchResults.map(async (r: SearchResult) => {
          try {
            const aptRes = await fetch(`/api/building/${r.bin}/apartments`);
            const aptData = await aptRes.json();
            return { bin: r.bin, apartments: aptData.apartments || [] };
          } catch { return { bin: r.bin, apartments: [] }; }
        });
        const aptResults = await Promise.all(aptPromises);
        const aptMap: Record<string, string[]> = {};
        aptResults.forEach(({ bin, apartments }) => { aptMap[bin] = apartments; });
        setApartmentsByBin(aptMap);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }

  function gradeColor(g: string | null) {
    if (!g) return "bg-gray-200 text-gray-600";
    if (g === "A") return "bg-green-100 text-green-800";
    if (g === "B") return "bg-blue-100 text-blue-800";
    if (g === "C") return "bg-yellow-100 text-yellow-800";
    if (g === "D") return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  }

  function navigate(bin: string, apt?: string, displayAddr?: string) {
    setShowDropdown(false);
    const params = new URLSearchParams();
    if (apt) params.set("apt", apt);
    if (displayAddr) params.set("addr", displayAddr);
    const qs = params.toString();
    router.push(`/building/${bin}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Enter address to find an apartment or building"
        className={`w-full border border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm ${large ? "px-6 py-4 text-lg" : "px-4 py-3 text-base"}`}
      />
      {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">...</div>}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
          {results.map((r) => {
            const apts = apartmentsByBin[r.bin] || [];
            return (
              <div key={r.bin} className="border-b border-gray-50 last:border-0">
                {/* Building row */}
                <button
                  onClick={() => navigate(r.bin, undefined, r.display_address || r.address)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{r.display_address || r.address}</div>
                    {r.matched_alias && r.address !== r.matched_alias && (
                      <div className="text-xs text-gray-400">aka {r.address}</div>
                    )}
                    <div className="text-sm text-gray-500">{r.borough} {r.zip}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.open_class_c ? <span className="text-xs text-red-600 font-medium">{r.open_class_c} Class C</span> : null}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeColor(r.score_grade)}`}>{r.score_grade || "?"}</span>
                  </div>
                </button>
                {/* Apartments indented underneath */}
                {apts.length > 0 && (
                  <div className="pl-8 pr-4 pb-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Apartments</div>
                    <div className="flex flex-wrap gap-1">
                      {apts.map((apt) => (
                        <button
                          key={apt}
                          onClick={() => navigate(r.bin, apt, r.display_address || r.address)}
                          className="px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-100 font-medium"
                        >
                          {apt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-gray-500 text-center">
          No buildings found
        </div>
      )}
    </div>
  );
}
