"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import CodeGlossary from "./CodeGlossary";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
  className?: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string; color?: string }[];
}

export interface GlossarySection {
  title: string;
  entries: { code: string; label: string }[];
}

interface ListPageProps {
  title: string;
  apiPath: string;
  columns: Column[];
  filters: FilterDef[];
  defaultSort: string;
  defaultOrder?: string;
  onRowClick: (row: any, index: number, allData: any[]) => void;
  selectedIndex?: number;
  rowHighlight?: (row: any) => string;
  searchPlaceholder?: string;
  glossary?: GlossarySection[];
}

export default function ListPage({
  title, apiPath, columns, filters, defaultSort, defaultOrder = "desc",
  onRowClick, selectedIndex, rowHighlight, searchPlaceholder = "Search...", glossary
}: ListPageProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bin = params.bin as string;
  const apt = searchParams.get("apt") || "";
  const addrParam = searchParams.get("addr") || "";

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(searchParams.get("sort") || defaultSort);
  const [order, setOrder] = useState(searchParams.get("order") || defaultOrder);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (filters) {
      filters.forEach(f => {
        const val = searchParams.get(f.key);
        if (val) initial[f.key] = val;
      });
    }
    return initial;
  });
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(addrParam);

  // Fetch canonical address (use as fallback if no addr param)
  useEffect(() => {
    if (!addrParam) {
      fetch(`/api/building/${bin}`)
        .then(r => r.json())
        .then(d => setAddress(d.building?.address || ""))
        .catch(() => {});
    }
  }, [bin, addrParam]);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", "25");
    p.set("sort", sort);
    p.set("order", order);
    if (search) p.set("search", search);
    if (apt) p.set("apt", apt);
    Object.entries(activeFilters).forEach(([k, v]) => { if (v) p.set(k, v); });

    fetch(`/api/building/${bin}/${apiPath}?${p.toString()}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bin, page, sort, order, search, activeFilters, apt, apiPath]);

  const totalPages = Math.ceil(total / 25);

  const toggleSort = (col: string) => {
    if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc");
    else { setSort(col); setOrder("desc"); }
    setPage(1);
  };

  const toggleFilter = (key: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
    setPage(1);
  };

  // Preserve all search params for navigation
  const backParams = new URLSearchParams();
  if (apt) backParams.set("apt", apt);
  if (addrParam) backParams.set("addr", addrParam);
  const backQs = backParams.toString() ? `?${backParams.toString()}` : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      <header className="bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-6xl mx-auto">
          <Link href={`/building/${bin}${backQs}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Back to report card
          </Link>
          <h1 className="text-xl md:text-2xl font-bold font-nunito text-gray-900 dark:text-gray-100 mt-1">
            {title}
          </h1>
          {address && <p className="text-sm text-gray-500 dark:text-gray-400">{address}</p>}
        </div>
      </header>

      {apt && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">Apt {apt}</span>
            <span className="text-blue-700 text-xs">Matching rows highlighted</span>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-3 md:px-4 py-4 space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

        {/* Filter pills + glossary */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <div key={f.key} className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">{f.label}:</span>
              {f.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleFilter(f.key, opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeFilters[f.key] === opt.value
                      ? "bg-blue-600 text-white"
                      : opt.color || "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Results count + glossary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">{total} result{total !== 1 ? "s" : ""}</div>
          {glossary && glossary.length > 0 && <CodeGlossary sections={glossary} />}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-[#1a1b2e] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No results found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b bg-gray-50 dark:bg-[#0f1117]">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide ${col.sortable !== false ? "cursor-pointer hover:text-gray-700 dark:text-gray-200 select-none" : ""} ${col.className || ""}`}
                      onClick={() => col.sortable !== false && toggleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sort === col.key && (
                          <span className="text-blue-600">{order === "asc" ? "↑" : "↓"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick(row, i, rows)}
                    className={`border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117] transition-colors ${
                      selectedIndex === i ? "bg-blue-100 ring-1 ring-blue-300" : ""
                    } ${rowHighlight ? rowHighlight(row) : ""}`}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={`px-3 py-2.5 text-xs ${col.className || ""}`}>
                        {col.render ? col.render(row) : (row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-[#1a1b2e] border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117]"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-[#1a1b2e] border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-[#0f1117]"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
