"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3Force from "d3-force";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import * as d3Drag from "d3-drag";
import Link from "next/link";

interface NetworkNode {
  id: string;
  type: "person" | "entity" | "building";
  label: string;
  building_count?: number;
  grade?: string;
  borough?: string;
  address?: string;
  open_class_c?: number;
  roles?: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkEdge {
  source: string | NetworkNode;
  target: string | NetworkNode;
  relation: string;
}

interface NetworkComparisons {
  avg_violations_per_building?: { value: number; city_avg: number };
  avg_open_class_c_per_building?: { value: number; city_avg: number };
  violation_percentile?: { value: number; percentile: number };
  penalty_percentile?: { value: number; percentile: number };
}

interface Props {
  centerName: string;
  initialSelectedId?: string;
  comparisons?: NetworkComparisons | null;
  ownerMode?: string;
}

const NODE_COLORS: Record<string, string> = { person: "#3b82f6", entity: "#8b5cf6", building: "#6b7280" };
const GRADE_COLORS: Record<string, string> = { A: "#22c55e", B: "#3b82f6", C: "#eab308", D: "#f97316", F: "#ef4444" };

function gradeBadge(g: string | undefined) {
  const cls = g === "A" ? "bg-green-100 text-green-800" : g === "B" ? "bg-blue-100 text-blue-800" : g === "C" ? "bg-yellow-100 text-yellow-800" : g === "D" ? "bg-orange-100 text-orange-800" : g === "F" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600";
  return cls;
}

export default function OwnerNetwork({ centerName, initialSelectedId, comparisons, ownerMode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<any>(null);
  const fitRef = useRef<() => void>(() => {});
  const [rawData, setRawData] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[]; stats: any } | null>(null);
  const [data, setData] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NetworkNode } | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [sidebarBuildings, setSidebarBuildings] = useState<NetworkNode[]>([]);

  useEffect(() => {
    fetch(`/api/owner-network?name=${encodeURIComponent(centerName)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.nodes || d.nodes.length === 0) { setRawData(null); setLoading(false); return; }
        setRawData(d);

        const people = d.nodes.filter((n: NetworkNode) => n.type === "person").sort((a: NetworkNode, b: NetworkNode) => (b.building_count || 0) - (a.building_count || 0));
        const entities = d.nodes.filter((n: NetworkNode) => n.type === "entity").sort((a: NetworkNode, b: NetworkNode) => (b.building_count || 0) - (a.building_count || 0));
        const topPeople = new Set(people.slice(0, 15).map((n: NetworkNode) => n.id));
        const topEntities = new Set(entities.slice(0, 10).map((n: NetworkNode) => n.id));
        const keepIds = new Set([...topPeople, ...topEntities]);

        const buildingIds = new Set<string>();
        d.edges.forEach((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          if (keepIds.has(src) && tgt.startsWith("building:")) buildingIds.add(tgt);
          if (keepIds.has(tgt) && src.startsWith("building:")) buildingIds.add(src);
        });
        const bcc: Record<string, number> = {};
        d.edges.forEach((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          if (buildingIds.has(tgt)) bcc[tgt] = (bcc[tgt] || 0) + 1;
          if (buildingIds.has(src)) bcc[src] = (bcc[src] || 0) + 1;
        });
        const topBuildings = new Set([...buildingIds].sort((a, b) => (bcc[b] || 0) - (bcc[a] || 0)).slice(0, 60));
        const allKeep = new Set([...keepIds, ...topBuildings]);

        setData({
          nodes: d.nodes.filter((n: NetworkNode) => allKeep.has(n.id)),
          edges: d.edges.filter((e: NetworkEdge) => {
            const src = typeof e.source === "string" ? e.source : e.source.id;
            const tgt = typeof e.target === "string" ? e.target : e.target.id;
            return allKeep.has(src) && allKeep.has(tgt);
          }),
          stats: d.stats,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [centerName]);

  // Auto-select initial node (for back navigation)
  useEffect(() => {
    if (initialSelectedId && rawData && data) {
      const node = data.nodes.find(n => n.id === initialSelectedId) || rawData.nodes.find(n => n.id === initialSelectedId);
      if (node) handleNodeClick(node);
    }
  }, [initialSelectedId, rawData, data]);

  const handleNodeClick = useCallback((node: NetworkNode) => {
    if (node.type === "building") return; // buildings handled via sidebar links
    setSelectedNode(node);
    if (!rawData) return;
    const connectedBuildingIds = new Set<string>();
    rawData.edges.forEach((e: NetworkEdge) => {
      const src = typeof e.source === "string" ? e.source : e.source.id;
      const tgt = typeof e.target === "string" ? e.target : e.target.id;
      if (src === node.id && tgt.startsWith("building:")) connectedBuildingIds.add(tgt);
      if (tgt === node.id && src.startsWith("building:")) connectedBuildingIds.add(src);
    });
    setSidebarBuildings(
      rawData.nodes.filter((n: NetworkNode) => connectedBuildingIds.has(n.id))
        .sort((a: NetworkNode, b: NetworkNode) => (b.open_class_c || 0) - (a.open_class_c || 0))
    );
  }, [rawData]);

  const resetZoom = useCallback(() => {
    fitRef.current();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const svg = d3Selection.select(svgRef.current);
    const container = svgRef.current.parentElement;
    const size = container ? Math.min(container.clientWidth, 600) : 500;
    svg.attr("width", size).attr("height", size);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    const nodes: NetworkNode[] = data.nodes.map(n => ({ ...n }));
    const edges = data.edges.map(e => ({
      ...e,
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
    }));

    function nodeRadius(n: NetworkNode) {
      if (n.type === "building") return 3;
      if (n.type === "entity") return Math.min(5 + (n.building_count || 0) * 0.25, 14);
      return Math.min(5 + (n.building_count || 0) * 0.15, 16);
    }
    function nodeColor(n: NetworkNode) {
      if (n.type === "building" && n.grade) return GRADE_COLORS[n.grade] || NODE_COLORS.building;
      return NODE_COLORS[n.type] || "#999";
    }

    const simulation = d3Force.forceSimulation(nodes as d3Force.SimulationNodeDatum[])
      .force("link", d3Force.forceLink(edges).id((d: any) => d.id).distance(25).strength(0.7))
      .force("charge", d3Force.forceManyBody().strength(-30).distanceMax(150))
      .force("center", d3Force.forceCenter(size / 2, size / 2).strength(0.15))
      .force("x", d3Force.forceX(size / 2).strength(0.08))
      .force("y", d3Force.forceY(size / 2).strength(0.08))
      .force("collision", d3Force.forceCollide().radius((d: any) => nodeRadius(d) + 1));

    const link = g.append("g").selectAll("line").data(edges).join("line")
      .attr("stroke", "#d1d5db").attr("stroke-opacity", 0.25).attr("stroke-width", 0.5);

    const node = g.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("r", (d: any) => nodeRadius(d))
      .attr("fill", (d: any) => nodeColor(d))
      .attr("stroke", "#fff").attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function(event: any, d: any) {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, node: d });
        d3Selection.select(this).attr("stroke", "#000").attr("stroke-width", 2);
      })
      .on("mouseout", function() {
        setTooltip(null);
        d3Selection.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
      })
      .on("click", (_event: any, d: any) => handleNodeClick(d));

    const label = g.append("g").selectAll("text")
      .data(nodes.filter(n => n.type !== "building")).join("text")
      .text((d: any) => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label)
      .attr("font-size", "6px").attr("fill", "#374151")
      .attr("text-anchor", "middle").attr("dy", (d: any) => -nodeRadius(d) - 2)
      .style("pointer-events", "none");

    node.call(d3Drag.drag<any, any>()
      .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    const doFit = () => {
      const xs = nodes.map(n => n.x || 0);
      const ys = nodes.map(n => n.y || 0);
      if (xs.length === 0) return;
      const pad = 40;
      const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
      const bw = maxX - minX, bh = maxY - minY;
      const scale = Math.min(size / bw, size / bh, 2) * 0.9;
      const tx = (size - bw * scale) / 2 - minX * scale;
      const ty = (size - bh * scale) / 2 - minY * scale;
      svg.transition().duration(400).call(zoom.transform as any, d3Zoom.zoomIdentity.translate(tx, ty).scale(scale));
    };
    fitRef.current = doFit;
    simulation.on("end", doFit);

    return () => { simulation.stop(); };
  }, [data, handleNodeClick]);

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading network...</div>;
  if (!data) return null;

  // Build back-to URL params for building links
  const ownerBackParams = `from_owner=${encodeURIComponent(centerName)}${selectedNode ? `&network_node=${encodeURIComponent(selectedNode.id)}` : ""}${ownerMode ? `&owner_mode=${encodeURIComponent(ownerMode)}` : ""}`;

  return (
    <div>
      {/* Main layout: stats left, graph right-aligned */}
      <div className="flex gap-6 flex-col md:flex-row">
        {/* Left panel: stats + legend + building list */}
        <div className="md:w-64 shrink-0 flex flex-col gap-4">
          {/* Stats */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Buildings</span><span className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_buildings}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">People</span><span className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_people}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Entities</span><span className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_entities}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400 text-xs">Boroughs</span><div className="text-xs font-medium text-gray-900 dark:text-gray-100">{data.stats.boroughs?.join(", ")}</div></div>
          </div>

          {/* Network comparisons */}
          {comparisons && (
            <div className="space-y-3 text-xs border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="text-gray-600 dark:text-gray-300 font-semibold text-sm">vs. NYC Owners</div>
              {comparisons.avg_violations_per_building && (() => {
                const v = comparisons.avg_violations_per_building;
                const ratio = v.city_avg > 0 ? v.value / v.city_avg : 0;
                const isWorse = v.value > v.city_avg;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Violations / building</span>
                      <span className={`font-bold ${isWorse ? "text-red-600" : "text-green-600"}`}>{v.value.toFixed(1)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      City avg: {v.city_avg.toFixed(1)}
                      {ratio > 1.01 && <span className="text-red-500 font-medium"> · {ratio.toFixed(1)}×</span>}
                    </div>
                  </div>
                );
              })()}
              {comparisons.avg_open_class_c_per_building && (() => {
                const v = comparisons.avg_open_class_c_per_building;
                const ratio = v.city_avg > 0 ? v.value / v.city_avg : 0;
                const isWorse = v.value > v.city_avg;
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Open Class C / building</span>
                      <span className={`font-bold ${isWorse ? "text-red-600" : "text-green-600"}`}>{v.value.toFixed(1)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      City avg: {v.city_avg.toFixed(1)}
                      {ratio > 1.01 && <span className="text-red-500 font-medium"> · {ratio.toFixed(1)}×</span>}
                    </div>
                  </div>
                );
              })()}
              {comparisons.violation_percentile && (
                <div className="bg-gray-50 dark:bg-[#0a0b14] rounded-lg px-2.5 py-2 mt-1">
                  <div className={`font-bold text-sm ${comparisons.violation_percentile.percentile > 80 ? "text-red-600" : comparisons.violation_percentile.percentile > 50 ? "text-orange-500" : "text-green-600"}`}>
                    Worse than {Math.round(comparisons.violation_percentile.percentile)}%
                  </div>
                  <div className="text-[10px] text-gray-400">of NYC owners with 2+ buildings</div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Person</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Entity</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Building</div>
            <div className="text-[10px] text-gray-400 mt-1">Click person/entity for buildings</div>
          </div>

          {/* Placeholder for spacing when no selection */}
        </div>

        {/* Right: Graph (square, right-aligned) */}
        <div className="flex-1 min-w-0 flex justify-end">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-[#0a0b14] relative aspect-square max-h-[600px] w-full max-w-[600px]">
            <svg ref={svgRef} className="w-full h-full" />
            {/* Reset button */}
            <button
              onClick={resetZoom}
              className="absolute bottom-2 left-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm z-10"
            >
              ⟲ Reset view
            </button>
            {tooltip && (
              <div
                className="absolute pointer-events-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-lg text-xs z-50 max-w-xs"
                style={{ left: Math.min(tooltip.x + 10, (svgRef.current?.clientWidth || 400) - 180), top: tooltip.y }}
              >
                <div className="font-semibold text-gray-900 dark:text-gray-100">{tooltip.node.label}</div>
                <div className="text-gray-500 dark:text-gray-400">
                  {tooltip.node.type === "building" && <>Grade: {tooltip.node.grade || "?"} · {tooltip.node.borough}</>}
                  {tooltip.node.type === "person" && <>{tooltip.node.building_count} buildings · {tooltip.node.roles?.join(", ")}</>}
                  {tooltip.node.type === "entity" && <>{tooltip.node.building_count} buildings</>}
                </div>
                {tooltip.node.type !== "building" && <div className="text-blue-500 mt-0.5">Click to see buildings →</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-in drawer for building list */}
      {selectedNode && sidebarBuildings.length > 0 && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedNode(null); setSidebarBuildings([]); }} />
          <div className="relative w-full max-w-lg md:max-w-xl bg-white dark:bg-[#1a1b2e] shadow-2xl dark:shadow-none overflow-y-auto animate-slide-in-right max-md:max-w-full max-md:rounded-t-2xl max-md:mt-16">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1a1b2e] border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <h2 className="text-lg font-bold font-nunito text-gray-900 dark:text-gray-100 truncate">{selectedNode.label}</h2>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedNode.type === "person" ? selectedNode.roles?.join(", ") : "Entity"} · {sidebarBuildings.length} building{sidebarBuildings.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => { setSelectedNode(null); setSidebarBuildings([]); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none shrink-0 ml-2">×</button>
            </div>
            {/* Building list */}
            <div className="px-4 md:px-6 py-3">
              {sidebarBuildings.map((b) => {
                const bin = b.id.replace("building:", "");
                return (
                  <Link key={bin} href={`/building/${bin}?${ownerBackParams}`} className="flex items-center gap-3 px-3 py-3 -mx-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${gradeBadge(b.grade)}`}>{b.grade || "?"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.address || b.label}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{b.borough}{(b.open_class_c || 0) > 0 ? ` · ${b.open_class_c} open Class C` : ""}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
