"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  Plus,
  Table as TableIcon,
  FileJson,
  Globe,
  Upload,
  RefreshCw,
  Eye,
  Settings,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Zap,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";

interface DataSource {
  id: string;
  name: string;
  displayName: string;
  sourceType: string;
  status: string;
  lastSyncAt: string | null;
  config: Record<string, unknown>;
}

interface SemanticEntity {
  id: string;
  name: string;
  displayName: string;
  sourceTable: string;
  description: string;
  domainAgent: string;
}

const sourceTypeIcons: Record<string, typeof Database> = {
  database: Database,
  csv: Upload,
  json: FileJson,
  api: Globe,
  web: Globe,
};

const sourceTypeLabels: Record<string, string> = {
  database: "Database",
  csv: "CSV File",
  json: "JSON File",
  api: "API Endpoint",
  web: "Web Scraper",
};

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [semanticEntities, setSemanticEntities] = useState<SemanticEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    entity: SemanticEntity | null;
    data: Record<string, unknown>[];
    open: boolean;
  }>({ entity: null, data: [], open: false });
  
  // Settings dialog state
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Form state
  const [newSource, setNewSource] = useState({
    name: "",
    displayName: "",
    sourceType: "database",
    config: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sourcesRes, entitiesRes] = await Promise.all([
        fetch("/api/data-sources"),
        fetch("/api/semantic-entities"),
      ]);
      
      if (sourcesRes.ok) {
        const sources = await sourcesRes.json();
        setDataSources(sources);
      }
      
      if (entitiesRes.ok) {
        const entities = await entitiesRes.json();
        setSemanticEntities(entities);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSource = async () => {
    try {
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newSource,
          config: newSource.config ? JSON.parse(newSource.config) : {},
        }),
      });
      
      if (response.ok) {
        setDialogOpen(false);
        setNewSource({ name: "", displayName: "", sourceType: "database", config: "" });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create data source:", error);
    }
  };

  const handlePreview = async (entity: SemanticEntity) => {
    try {
      const response = await fetch(`/api/data-preview?table=${entity.sourceTable}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewData({ entity, data: data.rows, open: true });
      }
    } catch (error) {
      console.error("Failed to preview data:", error);
    }
  };

  const handleEditSource = (source: DataSource) => {
    setEditingSource(source);
    setEditDialogOpen(true);
  };

  const handleSyncSource = async (source: DataSource) => {
    toast.info(`Syncing ${source.displayName}...`);
    // Simulate sync - in production this would trigger an ETL job
    setTimeout(() => {
      toast.success(`${source.displayName} synced successfully`);
      fetchData();
    }, 1500);
  };

  const handleDeleteSource = async (source: DataSource) => {
    if (!confirm(`Are you sure you want to delete "${source.displayName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/data-sources?id=${source.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        toast.success("Data source deleted");
        fetchData();
      } else {
        toast.error("Failed to delete data source");
      }
    } catch (error) {
      console.error("Failed to delete data source:", error);
      toast.error("Failed to delete data source");
    }
  };

  const handleUpdateSource = async () => {
    if (!editingSource) return;
    
    try {
      const response = await fetch(`/api/data-sources`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSource),
      });
      
      if (response.ok) {
        toast.success("Data source updated");
        setEditDialogOpen(false);
        setEditingSource(null);
        fetchData();
      } else {
        toast.error("Failed to update data source");
      }
    } catch (error) {
      console.error("Failed to update data source:", error);
      toast.error("Failed to update data source");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Data Sources</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Data Sources & Semantic Layer</h2>
              <p className="text-muted-foreground">
                Manage data sources and semantic entity mappings
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Data Source
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Data Source</DialogTitle>
                    <DialogDescription>
                      Connect a new data source to your agents
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name (identifier)</Label>
                      <Input
                        id="name"
                        placeholder="e.g., crm_data"
                        value={newSource.name}
                        onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        placeholder="e.g., CRM Data"
                        value={newSource.displayName}
                        onChange={(e) => setNewSource({ ...newSource, displayName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source Type</Label>
                      <Select
                        value={newSource.sourceType}
                        onValueChange={(value) => setNewSource({ ...newSource, sourceType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="database">Database Table</SelectItem>
                          <SelectItem value="csv">CSV File</SelectItem>
                          <SelectItem value="json">JSON File</SelectItem>
                          <SelectItem value="api">API Endpoint</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="config">Configuration (JSON)</Label>
                      <Textarea
                        id="config"
                        placeholder='{"tables": ["table1", "table2"]}'
                        value={newSource.config}
                        onChange={(e) => setNewSource({ ...newSource, config: e.target.value })}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateSource}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Data Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>Connected data sources for your agents</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : dataSources.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No data sources configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataSources.map((source) => {
                      const Icon = sourceTypeIcons[source.sourceType] || Database;
                      return (
                        <TableRow key={source.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{source.displayName}</div>
                                <div className="text-xs text-muted-foreground">{source.name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sourceTypeLabels[source.sourceType] || source.sourceType}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(source.status)}</TableCell>
                          <TableCell>
                            {source.lastSyncAt
                              ? new Date(source.lastSyncAt).toLocaleString()
                              : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditSource(source)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSyncSource(source)}>
                                  <Zap className="h-4 w-4 mr-2" />
                                  Sync Now
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteSource(source)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Semantic Entities */}
          <Card>
            <CardHeader>
              <CardTitle>Semantic Entities</CardTitle>
              <CardDescription>
                Business entities mapped to database tables for intelligent querying
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : semanticEntities.length === 0 ? (
                <div className="text-center py-8">
                  <TableIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No semantic entities defined</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Source Table</TableHead>
                      <TableHead>Domain Agent</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semanticEntities.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell>
                          <div className="font-medium">{entity.displayName}</div>
                          <div className="text-xs text-muted-foreground">{entity.name}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {entity.sourceTable}
                          </code>
                        </TableCell>
                        <TableCell>
                          {entity.domainAgent ? (
                            <Badge variant="outline">{entity.domainAgent}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entity.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(entity)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Preview Dialog */}
      <Dialog open={previewData.open} onOpenChange={(open) => setPreviewData({ ...previewData, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Data Preview: {previewData.entity?.displayName}
            </DialogTitle>
            <DialogDescription>
              Showing data from {previewData.entity?.sourceTable}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            {previewData.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(previewData.data[0])
                      .filter(k => !k.startsWith('_') && k !== 'embedding')
                      .slice(0, 8)
                      .map((key) => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.data.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      {Object.entries(row)
                        .filter(([k]) => !k.startsWith('_') && k !== 'embedding')
                        .slice(0, 8)
                        .map(([key, value]) => (
                          <TableCell key={key} className="text-xs max-w-[150px] truncate">
                            {value === null ? '-' : String(value)}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No data available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Data Source Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Source</DialogTitle>
            <DialogDescription>
              Update the data source configuration
            </DialogDescription>
          </DialogHeader>
          {editingSource && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Display Name</Label>
                <Input
                  id="edit-displayName"
                  value={editingSource.displayName}
                  onChange={(e) => setEditingSource({ ...editingSource, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={editingSource.sourceType}
                  onValueChange={(value) => setEditingSource({ ...editingSource, sourceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="database">Database Table</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="json">JSON File</SelectItem>
                    <SelectItem value="api">API Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingSource.status}
                  onValueChange={(value) => setEditingSource({ ...editingSource, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSource}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
