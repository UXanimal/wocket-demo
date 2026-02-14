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

interface Props {
  centerName: string;
}

const NODE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  entity: "#8b5cf6",
  building: "#6b7280",
};

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#3b82f6", C: "#eab308", D: "#f97316", F: "#ef4444",
};

export default function OwnerNetwork({ centerName }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
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

        // Filter for visualization
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

        const buildingConnectionCount: Record<string, number> = {};
        d.edges.forEach((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          if (buildingIds.has(tgt)) buildingConnectionCount[tgt] = (buildingConnectionCount[tgt] || 0) + 1;
          if (buildingIds.has(src)) buildingConnectionCount[src] = (buildingConnectionCount[src] || 0) + 1;
        });
        const topBuildings = new Set(
          [...buildingIds].sort((a, b) => (buildingConnectionCount[b] || 0) - (buildingConnectionCount[a] || 0)).slice(0, 60)
        );

        const allKeep = new Set([...keepIds, ...topBuildings]);
        const filteredNodes = d.nodes.filter((n: NetworkNode) => allKeep.has(n.id));
        const filteredEdges = d.edges.filter((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          return allKeep.has(src) && allKeep.has(tgt);
        });

        setData({ nodes: filteredNodes, edges: filteredEdges, stats: d.stats });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [centerName]);

  // When a person/entity node is clicked, find their connected buildings from raw data
  const handleNodeClick = useCallback((node: NetworkNode) => {
    if (node.type === "building") {
      // Navigate to building
      window.location.href = `/building/${node.id.replace("building:", "")}`;
      return;
    }

    setSelectedNode(node);

    if (!rawData) return;

    // Find all buildings connected to this node
    const connectedBuildingIds = new Set<string>();
    rawData.edges.forEach((e: NetworkEdge) => {
      const src = typeof e.source === "string" ? e.source : e.source.id;
      const tgt = typeof e.target === "string" ? e.target : e.target.id;
      if (src === node.id && tgt.startsWith("building:")) connectedBuildingIds.add(tgt);
      if (tgt === node.id && src.startsWith("building:")) connectedBuildingIds.add(src);
    });

    const buildings = rawData.nodes
      .filter((n: NetworkNode) => connectedBuildingIds.has(n.id))
      .sort((a: NetworkNode, b: NetworkNode) => (b.open_class_c || 0) - (a.open_class_c || 0));

    setSidebarBuildings(buildings);
  }, [rawData]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3Selection.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 500;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const nodes: NetworkNode[] = data.nodes.map(n => ({ ...n }));
    const edges = data.edges.map(e => ({
      ...e,
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
    }));

    function nodeRadius(n: NetworkNode) {
      if (n.type === "building") return 3.5;
      if (n.type === "entity") return Math.min(5 + (n.building_count || 0) * 0.25, 16);
      return Math.min(5 + (n.building_count || 0) * 0.15, 18);
    }

    function nodeColor(n: NetworkNode) {
      if (n.type === "building" && n.grade) return GRADE_COLORS[n.grade] || NODE_COLORS.building;
      return NODE_COLORS[n.type] || "#999";
    }

    // Tighter simulation — stronger center pull, shorter links, less repulsion
    const simulation = d3Force.forceSimulation(nodes as d3Force.SimulationNodeDatum[])
      .force("link", d3Force.forceLink(edges).id((d: any) => d.id).distance(30).strength(0.6))
      .force("charge", d3Force.forceManyBody().strength(-40).distanceMax(200))
      .force("center", d3Force.forceCenter(width / 2, height / 2).strength(0.1))
      .force("x", d3Force.forceX(width / 2).strength(0.05))
      .force("y", d3Force.forceY(height / 2).strength(0.05))
      .force("collision", d3Force.forceCollide().radius((d: any) => nodeRadius(d) + 1));

    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 0.5);

    // Nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d: any) => nodeRadius(d))
      .attr("fill", (d: any) => nodeColor(d))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
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
      .on("click", (_event: any, d: any) => {
        handleNodeClick(d);
      });

    // Labels for people and entities
    const label = g.append("g")
      .selectAll("text")
      .data(nodes.filter(n => n.type !== "building"))
      .join("text")
      .text((d: any) => d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label)
      .attr("font-size", (d: any) => d.type === "person" ? "7px" : "6px")
      .attr("fill", "#374151")
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => -nodeRadius(d) - 2)
      .style("pointer-events", "none");

    node.call(d3Drag.drag<any, any>()
      .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    // Auto-fit after simulation settles
    simulation.on("end", () => {
      const xs = nodes.map(n => n.x || 0);
      const ys = nodes.map(n => n.y || 0);
      const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30;
      const minY = Math.min(...ys) - 30, maxY = Math.max(...ys) + 30;
      const bw = maxX - minX, bh = maxY - minY;
      const scale = Math.min(width / bw, height / bh, 1.5) * 0.9;
      const tx = (width - bw * scale) / 2 - minX * scale;
      const ty = (height - bh * scale) / 2 - minY * scale;
      svg.transition().duration(500).call(
        zoom.transform as any,
        d3Zoom.zoomIdentity.translate(tx, ty).scale(scale)
      );
    });

    return () => { simulation.stop(); };
  }, [data, handleNodeClick]);

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading network...</div>;
  if (!data) return null;

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 mb-3 text-sm">
        <div><span className="text-gray-500 dark:text-gray-400">Buildings</span><div className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_buildings}</div></div>
        <div><span className="text-gray-500 dark:text-gray-400">People</span><div className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_people}</div></div>
        <div><span className="text-gray-500 dark:text-gray-400">Entities</span><div className="font-medium text-gray-900 dark:text-gray-100">{data.stats.total_entities}</div></div>
        <div><span className="text-gray-500 dark:text-gray-400">Boroughs</span><div className="font-medium text-gray-900 dark:text-gray-100">{data.stats.boroughs?.join(", ")}</div></div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Person</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Entity</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Building</span>
        <span className="text-gray-400 ml-2">Click person/entity to see buildings</span>
      </div>

      {/* Graph + Sidebar */}
      <div className="flex gap-3">
        {/* Graph */}
        <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-[#0a0b14] relative ${selectedNode ? "flex-1" : "w-full"}`}>
          <svg ref={svgRef} width="100%" height={500} />
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

        {/* Sidebar */}
        {selectedNode && (
          <div className="w-72 shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1a1b2e] overflow-hidden flex flex-col" style={{ height: 500 }}>
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{selectedNode.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedNode.type === "person" ? selectedNode.roles?.join(", ") : "Entity"} · {sidebarBuildings.length} building{sidebarBuildings.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => { setSelectedNode(null); setSidebarBuildings([]); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarBuildings.map((b) => {
                const bin = b.id.replace("building:", "");
                return (
                  <Link key={bin} href={`/building/${bin}`} className="block px-3 py-2 border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        b.grade === "A" ? "bg-green-100 text-green-800" :
                        b.grade === "B" ? "bg-blue-100 text-blue-800" :
                        b.grade === "C" ? "bg-yellow-100 text-yellow-800" :
                        b.grade === "D" ? "bg-orange-100 text-orange-800" :
                        b.grade === "F" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>{b.grade || "?"}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{b.address || b.label}</div>
                        <div className="text-[10px] text-gray-400">{b.borough}{(b.open_class_c || 0) > 0 ? ` · ${b.open_class_c} Class C` : ""}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {sidebarBuildings.length === 0 && (
                <div className="text-center text-gray-400 text-xs py-6">No buildings found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
