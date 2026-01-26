"use client";

import { useState, useEffect, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  Workflow,
  Plus,
  Play,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  History,
  Brain,
  Zap,
  FileUp,
  Globe,
  Database,
  Upload,
  File,
} from "lucide-react";

interface ETLJob {
  id: string;
  jobType: string;
  status: string;
  config: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  result?: Record<string, unknown>;
  errorMessage?: string;
}

interface ETLJobRun {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  recordsProcessed: number;
  recordsFailed: number;
  parIterations: number;
  reflexionImprovements: string[];
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
}

const jobTypeIcons: Record<string, typeof Database> = {
  csv_import: FileUp,
  json_import: FileUp,
  api_fetch: Globe,
  kg_build: Brain,
  data_sync: Database,
};

const jobTypeLabels: Record<string, string> = {
  csv_import: "CSV Import",
  json_import: "JSON Import",
  api_fetch: "API Fetch",
  kg_build: "Knowledge Graph Build",
  data_sync: "Data Sync",
};

export default function ETLJobsPage() {
  const [jobs, setJobs] = useState<ETLJob[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ETLJob | null>(null);
  const [jobRuns, setJobRuns] = useState<ETLJobRun[]>([]);
  const [runsDialogOpen, setRunsDialogOpen] = useState(false);

  // File upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadConfig, setUploadConfig] = useState({
    targetTable: "",
    autoImport: true,
    mode: "insert",
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);

  // Form state
  const [newJob, setNewJob] = useState({
    jobType: "csv_import",
    name: "",
    config: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, statsRes] = await Promise.all([
        fetch("/api/etl/jobs"),
        fetch("/api/graph/stats"),
      ]);
      
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setGraphStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildKnowledgeGraph = async () => {
    setBuilding(true);
    try {
      const response = await fetch("/api/graph/build", { method: "POST" });
      if (response.ok) {
        const result = await response.json();
        setGraphStats(result.stats);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to build knowledge graph:", error);
    } finally {
      setBuilding(false);
    }
  };

  const handleCreateJob = async () => {
    try {
      const response = await fetch("/api/etl/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: newJob.jobType,
          config: newJob.config ? JSON.parse(newJob.config) : {},
        }),
      });
      
      if (response.ok) {
        setDialogOpen(false);
        setNewJob({ jobType: "csv_import", name: "", config: "" });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create job:", error);
    }
  };

  const handleRunJob = async (jobId: string) => {
    try {
      await fetch(`/api/etl/jobs/${jobId}/run`, { method: "POST" });
      fetchData();
    } catch (error) {
      console.error("Failed to run job:", error);
    }
  };

  const handleViewRuns = async (job: ETLJob) => {
    setSelectedJob(job);
    try {
      const response = await fetch(`/api/etl/jobs/${job.id}/runs`);
      if (response.ok) {
        const data = await response.json();
        setJobRuns(data);
      }
    } catch (error) {
      console.error("Failed to fetch job runs:", error);
    }
    setRunsDialogOpen(true);
  };

  // File upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.name.endsWith(".json")) {
        setUploadFile(file);
        setUploadResult(null);
      } else {
        setUploadResult({
          success: false,
          message: "Invalid file type. Only CSV and JSON files are supported.",
        });
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("autoImport", String(uploadConfig.autoImport));
      formData.append("mode", uploadConfig.mode);
      if (uploadConfig.targetTable) {
        formData.append("targetTable", uploadConfig.targetTable);
      }

      const response = await fetch("/api/etl/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message,
          details: result,
        });
        fetchData();
        // Reset form after successful upload
        setTimeout(() => {
          setUploadFile(null);
          setUploadConfig({ targetTable: "", autoImport: true, mode: "insert" });
        }, 2000);
      } else {
        setUploadResult({
          success: false,
          message: result.error || "Upload failed",
          details: result,
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">ETL Jobs</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">ETL Jobs & Knowledge Graph</h2>
              <p className="text-muted-foreground">
                Manage data pipelines with PAR loops and self-learning
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Data File</DialogTitle>
                    <DialogDescription>
                      Upload a CSV or JSON file to import data with PAR loop processing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Drag and Drop Zone */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      {uploadFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <File className="h-8 w-8 text-primary" />
                          <div className="text-left">
                            <p className="font-medium">{uploadFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(uploadFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadFile(null)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Drag and drop a CSV or JSON file here, or
                          </p>
                          <label className="cursor-pointer">
                            <span className="text-primary hover:underline">
                              browse to select
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".csv,.json"
                              onChange={handleFileSelect}
                            />
                          </label>
                        </>
                      )}
                    </div>

                    {/* Configuration Options */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="targetTable">Target Table (optional)</Label>
                        <Input
                          id="targetTable"
                          placeholder="Auto-generated if empty"
                          value={uploadConfig.targetTable}
                          onChange={(e) =>
                            setUploadConfig({ ...uploadConfig, targetTable: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Import Mode</Label>
                        <Select
                          value={uploadConfig.mode}
                          onValueChange={(value) =>
                            setUploadConfig({ ...uploadConfig, mode: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="insert">Insert (append rows)</SelectItem>
                            <SelectItem value="replace">Replace (truncate first)</SelectItem>
                            <SelectItem value="upsert">Upsert (update existing)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="autoImport"
                          checked={uploadConfig.autoImport}
                          onCheckedChange={(checked: boolean) =>
                            setUploadConfig({ ...uploadConfig, autoImport: checked })
                          }
                        />
                        <Label htmlFor="autoImport" className="text-sm">
                          Import immediately after upload
                        </Label>
                      </div>
                    </div>

                    {/* Result Message */}
                    {uploadResult && (
                      <div
                        className={`p-3 rounded-lg text-sm ${
                          uploadResult.success
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {uploadResult.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {uploadResult.message}
                        </div>
                        {uploadResult.details && 'recordsProcessed' in uploadResult.details && (
                          <p className="mt-1 text-xs">
                            {String(uploadResult.details.recordsProcessed)} records processed
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadDialogOpen(false);
                        setUploadFile(null);
                        setUploadResult(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={!uploadFile || uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Uploading..." : "Upload & Import"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create ETL Job</DialogTitle>
                    <DialogDescription>
                      Create a new ETL job with PAR loop processing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Job Type</Label>
                      <Select
                        value={newJob.jobType}
                        onValueChange={(value) => setNewJob({ ...newJob, jobType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv_import">CSV Import</SelectItem>
                          <SelectItem value="json_import">JSON Import</SelectItem>
                          <SelectItem value="api_fetch">API Fetch</SelectItem>
                          <SelectItem value="kg_build">Knowledge Graph Build</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="config">Configuration (JSON)</Label>
                      <Textarea
                        id="config"
                        placeholder='{"targetTable": "my_data"}'
                        value={newJob.config}
                        onChange={(e) => setNewJob({ ...newJob, config: e.target.value })}
                        className="font-mono text-sm h-32"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateJob}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Knowledge Graph Stats */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Knowledge Graph
                  </CardTitle>
                  <CardDescription>
                    Entity relationships for GraphRAG-lite retrieval
                  </CardDescription>
                </div>
                <Button onClick={handleBuildKnowledgeGraph} disabled={building}>
                  {building ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {building ? "Building..." : "Rebuild Graph"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {graphStats ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold">{graphStats.totalNodes}</div>
                    <div className="text-sm text-muted-foreground">Total Nodes</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold">{graphStats.totalEdges}</div>
                    <div className="text-sm text-muted-foreground">Total Edges</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Nodes by Type</div>
                    <div className="space-y-1 text-xs">
                      {Object.entries(graphStats.nodesByType).slice(0, 4).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-muted-foreground">{type}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Edges by Type</div>
                    <div className="space-y-1 text-xs">
                      {Object.entries(graphStats.edgesByType).slice(0, 4).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-muted-foreground">{type}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No knowledge graph built yet. Click "Rebuild Graph" to create one.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ETL Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>ETL Jobs</CardTitle>
              <CardDescription>
                Data pipeline jobs with Plan-Act-Reflect (PAR) loops
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8">
                  <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No ETL jobs configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a job to import data with self-correcting PAR loops
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      const Icon = jobTypeIcons[job.jobType] || Workflow;
                      const result = job.result as Record<string, number> | undefined;
                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {jobTypeLabels[job.jobType] || job.jobType}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {job.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            {job.completedAt
                              ? new Date(job.completedAt).toLocaleString()
                              : job.startedAt
                                ? "Running..."
                                : "Never"}
                          </TableCell>
                          <TableCell>
                            {result?.recordsProcessed !== undefined
                              ? `${result.recordsProcessed} processed`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewRuns(job)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRunJob(job.id)}
                                disabled={job.status === "running"}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* PAR Loop Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                PAR Loop Engine
              </CardTitle>
              <CardDescription>
                Self-correcting ETL with Plan-Act-Reflect
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <span className="text-blue-500 font-bold">P</span>
                    </div>
                    <h4 className="font-medium">Perceive</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Analyze input data, detect schema, identify patterns and potential issues.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <span className="text-green-500 font-bold">A</span>
                    </div>
                    <h4 className="font-medium">Act</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Execute data transformation, apply mappings, insert into target tables.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <span className="text-purple-500 font-bold">R</span>
                    </div>
                    <h4 className="font-medium">Reflect</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Evaluate results, learn from errors, adjust strategy for next iteration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Job Runs Dialog */}
      <Dialog open={runsDialogOpen} onOpenChange={setRunsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Job Run History</DialogTitle>
            <DialogDescription>
              {selectedJob ? jobTypeLabels[selectedJob.jobType] || selectedJob.jobType : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            {jobRuns.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No runs yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>PAR Iterations</TableHead>
                    <TableHead>Improvements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell>
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-600">{run.recordsProcessed}</span>
                          {run.recordsFailed > 0 && (
                            <span className="text-red-600 ml-2">({run.recordsFailed} failed)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{run.parIterations} iterations</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {run.reflexionImprovements?.length > 0 ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {run.reflexionImprovements.join("; ")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
