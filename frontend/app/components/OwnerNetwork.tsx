"use client";
import { useEffect, useRef, useState } from "react";
import * as d3Force from "d3-force";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import * as d3Drag from "d3-drag";

interface NetworkNode {
  id: string;
  type: "person" | "entity" | "building";
  label: string;
  building_count?: number;
  grade?: string;
  borough?: string;
  roles?: string[];
  // d3 simulation adds these
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
  const [data, setData] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NetworkNode } | null>(null);

  useEffect(() => {
    fetch(`/api/owner-network?name=${encodeURIComponent(centerName)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.nodes || d.nodes.length === 0) { setData(null); setLoading(false); return; }

        // Filter for visualization: keep top people/entities + their buildings
        const people = d.nodes.filter((n: NetworkNode) => n.type === "person").sort((a: NetworkNode, b: NetworkNode) => (b.building_count || 0) - (a.building_count || 0));
        const entities = d.nodes.filter((n: NetworkNode) => n.type === "entity").sort((a: NetworkNode, b: NetworkNode) => (b.building_count || 0) - (a.building_count || 0));
        
        // Keep top 15 people, top 10 entities
        const topPeople = new Set(people.slice(0, 15).map((n: NetworkNode) => n.id));
        const topEntities = new Set(entities.slice(0, 10).map((n: NetworkNode) => n.id));
        const keepIds = new Set([...topPeople, ...topEntities]);

        // Find buildings connected to kept people/entities
        const buildingIds = new Set<string>();
        d.edges.forEach((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          if (keepIds.has(src) && tgt.startsWith("building:")) buildingIds.add(tgt);
          if (keepIds.has(tgt) && src.startsWith("building:")) buildingIds.add(src);
        });

        // Limit buildings to 50 most connected
        const buildingConnectionCount: Record<string, number> = {};
        d.edges.forEach((e: NetworkEdge) => {
          const src = typeof e.source === "string" ? e.source : e.source.id;
          const tgt = typeof e.target === "string" ? e.target : e.target.id;
          if (buildingIds.has(tgt)) buildingConnectionCount[tgt] = (buildingConnectionCount[tgt] || 0) + 1;
          if (buildingIds.has(src)) buildingConnectionCount[src] = (buildingConnectionCount[src] || 0) + 1;
        });
        const topBuildings = new Set(
          [...buildingIds].sort((a, b) => (buildingConnectionCount[b] || 0) - (buildingConnectionCount[a] || 0)).slice(0, 50)
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

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3Selection.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 500;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const nodes: NetworkNode[] = data.nodes.map(n => ({ ...n }));
    const edges = data.edges.map(e => ({
      ...e,
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
    }));

    // Node size based on type and connections
    function nodeRadius(n: NetworkNode) {
      if (n.type === "building") return 4;
      if (n.type === "entity") return Math.min(6 + (n.building_count || 0) * 0.3, 18);
      return Math.min(6 + (n.building_count || 0) * 0.2, 20);
    }

    function nodeColor(n: NetworkNode) {
      if (n.type === "building" && n.grade) return GRADE_COLORS[n.grade] || NODE_COLORS.building;
      return NODE_COLORS[n.type] || "#999";
    }

    const simulation = d3Force.forceSimulation(nodes as d3Force.SimulationNodeDatum[])
      .force("link", d3Force.forceLink(edges).id((d: any) => d.id).distance(60).strength(0.3))
      .force("charge", d3Force.forceManyBody().strength(-80))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collision", d3Force.forceCollide().radius((d: any) => nodeRadius(d) + 2));

    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-opacity", 0.4)
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
      });

    // Labels for people and entities (not buildings — too noisy)
    const label = g.append("g")
      .selectAll("text")
      .data(nodes.filter(n => n.type !== "building"))
      .join("text")
      .text((d: any) => d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label)
      .attr("font-size", (d: any) => d.type === "person" ? "8px" : "7px")
      .attr("fill", "#374151")
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => -nodeRadius(d) - 3)
      .style("pointer-events", "none");

    // Drag
    function drag(sim: any) {
      return d3Selection.select(null as any)
        .call(() => {})
        .on("start", (event: any, d: any) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event: any, d: any) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    }

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

    return () => { simulation.stop(); };
  }, [data]);

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
        <span className="text-gray-400 ml-2">Scroll to zoom · Drag to pan</span>
      </div>

      {/* Graph */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-[#0a0b14] relative">
        <svg ref={svgRef} width="100%" height={500} />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-lg text-xs z-50 max-w-xs"
            style={{ left: tooltip.x + 10, top: tooltip.y }}
          >
            <div className="font-semibold text-gray-900 dark:text-gray-100">{tooltip.node.label}</div>
            <div className="text-gray-500 dark:text-gray-400">
              {tooltip.node.type === "building" && <>Grade: {tooltip.node.grade || "?"} · {tooltip.node.borough}</>}
              {tooltip.node.type === "person" && <>{tooltip.node.building_count} buildings · {tooltip.node.roles?.join(", ")}</>}
              {tooltip.node.type === "entity" && <>{tooltip.node.building_count} buildings</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
