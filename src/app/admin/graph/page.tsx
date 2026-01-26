"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Network,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Search,
  X,
  ArrowRight,
  ArrowLeft,
  Database,
  Link2,
  RotateCcw,
  Loader2,
} from "lucide-react";

// Dynamically import react-force-graph-3d to avoid SSR issues
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-zinc-950">
      <div className="text-muted-foreground">Loading 3D graph...</div>
    </div>
  ),
});

interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  importanceScore: number;
  sourceTable?: string;
  sourceId?: string;
  // 3D position (set by force simulation)
  x?: number;
  y?: number;
  z?: number;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  relationshipType: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

interface ConnectedNode {
  node: GraphNode;
  relationshipType: string;
  direction: "incoming" | "outgoing";
}

// Node colors by type
const nodeColors: Record<string, string> = {
  customer: "#3b82f6", // blue
  employee: "#10b981", // green
  product: "#f59e0b", // amber
  nw_product: "#f59e0b",
  category: "#8b5cf6", // purple
  supplier: "#ec4899", // pink
  opportunity: "#06b6d4", // cyan
  ticket: "#ef4444", // red
  order: "#84cc16", // lime
};

export default function GraphVisualizationPage() {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [connectedNodes, setConnectedNodes] = useState<ConnectedNode[]>([]);
  const [sampleRecords, setSampleRecords] = useState<Record<string, unknown>[] | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    fetchGraphData();
  }, []);



  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/graph/data");
      if (response.ok) {
        const data = await response.json();
        setGraphData(data);
        
        // Extract unique node types
        const types = [...new Set(data.nodes.map((n: GraphNode) => n.type))];
        setNodeTypes(types as string[]);
      }
    } catch (error) {
      console.error("Failed to fetch graph data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sample records for a node
  const fetchSampleRecords = async (node: GraphNode) => {
    setLoadingSamples(true);
    setSampleRecords(null);
    try {
      const response = await fetch(`/api/graph/node/${node.id}/records`);
      if (response.ok) {
        const data = await response.json();
        setSampleRecords(data.records || []);
      }
    } catch (error) {
      console.error("Failed to fetch sample records:", error);
      setSampleRecords([]);
    } finally {
      setLoadingSamples(false);
    }
  };

  // Filter graph data based on selections
  const filteredData = useMemo(() => {
    let nodes = graphData.nodes;
    let links = graphData.links;

    // Filter by type
    if (filterType !== "all") {
      nodes = nodes.filter((n) => n.type === filterType);
      const nodeIds = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => {
        const sourceId = typeof l.source === "string" ? l.source : l.source.id;
        const targetId = typeof l.target === "string" ? l.target : l.target.id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query)
      );
      const nodeIds = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => {
        const sourceId = typeof l.source === "string" ? l.source : l.source.id;
        const targetId = typeof l.target === "string" ? l.target : l.target.id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });
    }

    return { nodes, links };
  }, [graphData, filterType, searchQuery]);

  // Calculate connected nodes when selection changes
  useEffect(() => {
    if (!selectedNode) {
      setConnectedNodes([]);
      return;
    }

    const nodeId = selectedNode.id;
    const connected: ConnectedNode[] = [];
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

    for (const link of graphData.links) {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (sourceId === nodeId) {
        const targetNode = nodeMap.get(targetId);
        if (targetNode) {
          connected.push({
            node: targetNode,
            relationshipType: link.relationshipType,
            direction: "outgoing",
          });
        }
      } else if (targetId === nodeId) {
        const sourceNode = nodeMap.get(sourceId);
        if (sourceNode) {
          connected.push({
            node: sourceNode,
            relationshipType: link.relationshipType,
            direction: "incoming",
          });
        }
      }
    }

    setConnectedNodes(connected);
  }, [selectedNode, graphData]);

  const handleNodeClick = useCallback((node: any) => {
    if (!node) return;
    const graphNode = node as GraphNode;
    setSelectedNode(graphNode);
    setActiveTab("details");
    
    // Center camera on node with animation
    if (graphRef.current) {
      const distance = 150;
      const nodeX = node.x || 0;
      const nodeY = node.y || 0;
      const nodeZ = node.z || 0;
      const nodeDistance = Math.hypot(nodeX, nodeY, nodeZ);
      
      // Avoid division by zero - if node is at origin, position camera along z-axis
      if (nodeDistance < 1) {
        graphRef.current.cameraPosition(
          { x: 0, y: 0, z: distance },
          { x: nodeX, y: nodeY, z: nodeZ },
          1000
        );
      } else {
        const distRatio = 1 + distance / nodeDistance;
        graphRef.current.cameraPosition(
          { x: nodeX * distRatio, y: nodeY * distRatio, z: nodeZ * distRatio },
          { x: nodeX, y: nodeY, z: nodeZ },
          1000
        );
      }
    }
  }, []);

  const handleConnectedNodeClick = (connectedNode: GraphNode) => {
    // Find the node in the graph and click it
    const node = filteredData.nodes.find(n => n.id === connectedNode.id);
    if (node) {
      handleNodeClick(node);
    }
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      try {
        const camera = graphRef.current.camera();
        if (camera && camera.position) {
          graphRef.current.cameraPosition(
            { x: camera.position.x * 0.7, y: camera.position.y * 0.7, z: camera.position.z * 0.7 },
            null,
            300
          );
        }
      } catch (e) {
        console.error("Zoom in failed:", e);
      }
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      try {
        const camera = graphRef.current.camera();
        if (camera && camera.position) {
          graphRef.current.cameraPosition(
            { x: camera.position.x * 1.3, y: camera.position.y * 1.3, z: camera.position.z * 1.3 },
            null,
            300
          );
        }
      } catch (e) {
        console.error("Zoom out failed:", e);
      }
    }
  };

  const handleResetView = () => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 500 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(1000, 100);
    }
  };

  // Get node color with glow effect for 3D
  const getNodeColor = (node: any) => nodeColors[node.type] || "#94a3b8";

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Knowledge Graph (3D)</h1>
        <Badge variant="secondary" className="ml-2">Interactive</Badge>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Graph Area */}
        <div ref={containerRef} className="flex-1 min-w-0 relative bg-zinc-950 overflow-hidden">
          {/* Controls */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <Card className="w-64 bg-background/95 backdrop-blur">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Node Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {nodeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFitView} title="Fit View">
                    <Maximize className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetView} title="Reset Camera">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchGraphData} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Instructions */}
            <Card className="w-64 bg-background/95 backdrop-blur">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Controls:</strong> Left-drag to rotate • Right-drag to pan • Scroll to zoom • Click node for details
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stats */}
          <div className="absolute top-4 right-4 z-10">
            <Card className="w-48 bg-background/95 backdrop-blur">
              <CardContent className="py-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold">{filteredData.nodes.length}</div>
                    <div className="text-xs text-muted-foreground">Nodes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{filteredData.links.length}</div>
                    <div className="text-xs text-muted-foreground">Edges</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graph */}
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading graph...
              </div>
            </div>
          ) : filteredData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Network className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No graph data available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Build the knowledge graph from the ETL page
                </p>
              </div>
            </div>
          ) : (
            <ForceGraph3D
              ref={graphRef}
              graphData={filteredData}
              nodeId="id"
              nodeLabel={(node: any) => `${node.type}: ${node.name}`}
              nodeColor={getNodeColor}
              nodeRelSize={5}
              nodeVal={(node: any) => Math.max(1, node.importanceScore * 8)}
              nodeOpacity={0.9}
              linkLabel={(link: any) => link.relationshipType}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkWidth={(link: any) => Math.max(0.5, link.weight)}
              linkColor={() => "rgba(148, 163, 184, 0.4)"}
              linkOpacity={0.6}
              onNodeClick={handleNodeClick}
              onNodeHover={(node: any) => {
                document.body.style.cursor = node ? 'pointer' : 'default';
              }}
              backgroundColor="#09090b"
              showNavInfo={false}
              enableNodeDrag={false}
              enableNavigationControls={true}
              enablePointerInteraction={true}
            />
          )}
        </div>

        {/* Node Details Sidebar */}
        {selectedNode && (
          <div className="w-96 flex-shrink-0 border-l bg-background flex flex-col relative z-20">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Node Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNode(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="connections" className="flex-1">
                  Connections ({connectedNodes.length})
                </TabsTrigger>
                <TabsTrigger value="records" className="flex-1" onClick={() => fetchSampleRecords(selectedNode)}>
                  Records
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 p-4 space-y-4 overflow-auto">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedNode.name}</p>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge
                    style={{ backgroundColor: nodeColors[selectedNode.type] }}
                    className="mt-1"
                  >
                    {selectedNode.type}
                  </Badge>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Importance Score
                  </Label>
                  <p>{(selectedNode.importanceScore * 100).toFixed(1)}%</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Node ID</Label>
                  <p className="font-mono text-xs break-all">{selectedNode.id}</p>
                </div>

                {Object.keys(selectedNode.properties).length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Properties</Label>
                    <div className="mt-2 space-y-2 bg-muted/50 rounded-md p-3">
                      {Object.entries(selectedNode.properties)
                        .filter(([_, v]) => v !== null && v !== undefined)
                        .map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-muted-foreground">{key}:</span>{" "}
                            <span className="break-all">{String(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="connections" className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {connectedNodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No connections found
                      </p>
                    ) : (
                      connectedNodes.map((conn, idx) => (
                        <Card
                          key={`${conn.node.id}-${idx}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleConnectedNodeClick(conn.node)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                              {conn.direction === "outgoing" ? (
                                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ArrowLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{conn.node.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    style={{ borderColor: nodeColors[conn.node.type], color: nodeColors[conn.node.type] }}
                                    className="text-xs"
                                  >
                                    {conn.node.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {conn.relationshipType}
                                  </span>
                                </div>
                              </div>
                              <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="records" className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {loadingSamples ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading records...</span>
                      </div>
                    ) : sampleRecords === null ? (
                      <div className="text-center py-8">
                        <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to load sample records from the source data
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => fetchSampleRecords(selectedNode)}
                        >
                          Load Records
                        </Button>
                      </div>
                    ) : sampleRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No source records available
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Showing {sampleRecords.length} sample record(s) from source
                        </p>
                        {sampleRecords.map((record, idx) => (
                          <Card key={idx}>
                            <CardContent className="p-3">
                              <div className="space-y-1.5">
                                {Object.entries(record)
                                  .filter(([_, v]) => v !== null && v !== undefined)
                                  .slice(0, 10)
                                  .map(([key, value]) => (
                                    <div key={key} className="text-sm">
                                      <span className="text-muted-foreground">{key}:</span>{" "}
                                      <span className="break-all">
                                        {typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                {Object.keys(record).length > 10 && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    +{Object.keys(record).length - 10} more fields
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border-t px-4 py-2 flex items-center gap-4 overflow-auto">
        <span className="text-xs text-muted-foreground">Legend:</span>
        {nodeTypes.map((type) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: nodeColors[type] || "#94a3b8" }}
            />
            <span className="text-xs">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
