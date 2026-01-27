"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ModelConfig {
  role: string;
  provider: string;
  modelName: string;
  config: Record<string, unknown>;
  fallbackProvider?: string;
  fallbackModel?: string;
}

interface ProviderStatus {
  openai: boolean;
  anthropic: boolean;
  ollama: boolean;
}

const roleDescriptions: Record<string, string> = {
  composer: "Main response generation",
  composer_fast: "Quick mode responses",
  planner: "Query planning and domain detection",
  reflection: "Answer quality review",
  mode_classifier: "Classify query complexity",
  memory_extractor: "Extract facts from conversation",
  embeddings: "Vector embeddings for RAG",
  image_generation: "Image creation",
  research: "Deep research mode",
};

const providerModels: Record<string, string[]> = {
  openai: [
    // GPT-5.2 series (latest)
    "gpt-5.2",
    "gpt-5.2-pro",
    "gpt-5-mini",
    "o3-deep-research",
    // GPT-4 series (legacy)
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    // Embeddings & image models
    "text-embedding-3-large",
    "text-embedding-3-small",
    "gpt-image-1.5",
  ],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  ollama: ["llama3.1:8b", "llama3.1:70b", "mistral", "codellama", "nomic-embed-text"],
};

export default function ModelConfigPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchProviderStatus();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch("/api/models");
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (error) {
      console.error("Failed to fetch configs:", error);
      // Use defaults if API fails
      setConfigs(getDefaultConfigs());
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderStatus = async () => {
    try {
      const response = await fetch("/api/models/status");
      if (response.ok) {
        const data = await response.json();
        setProviderStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch provider status:", error);
      setProviderStatus({ openai: false, anthropic: false, ollama: false });
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/models/${editingConfig.role}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingConfig),
      });

      if (response.ok) {
        const updated = await response.json();
        setConfigs((prev) =>
          prev.map((c) => (c.role === updated.role ? updated : c))
        );
        toast.success("Model configuration saved");
        setEditingConfig(null);
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Model Configuration</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Provider Status */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Status</CardTitle>
              <CardDescription>
                Check which LLM providers are available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  {getStatusIcon(providerStatus?.openai)}
                  <span>OpenAI</span>
                  <Badge variant={providerStatus?.openai ? "default" : "secondary"}>
                    {providerStatus?.openai ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(providerStatus?.anthropic)}
                  <span>Anthropic</span>
                  <Badge variant={providerStatus?.anthropic ? "default" : "secondary"}>
                    {providerStatus?.anthropic ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(providerStatus?.ollama)}
                  <span>Ollama</span>
                  <Badge variant={providerStatus?.ollama ? "default" : "secondary"}>
                    {providerStatus?.ollama ? "Available" : "Not available"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Assignments */}
          <Card>
            <CardHeader>
              <CardTitle>Model Assignments</CardTitle>
              <CardDescription>
                Configure which model to use for each role
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.role}>
                        <TableCell className="font-medium">{config.role}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {roleDescriptions[config.role] || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{config.provider}</Badge>
                        </TableCell>
                        <TableCell>{config.modelName}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingConfig(config)}
                          >
                            <Pencil className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model Configuration</DialogTitle>
            <DialogDescription>
              Configure the model for the {editingConfig?.role} role
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={editingConfig.provider}
                  onValueChange={(value) =>
                    setEditingConfig({ ...editingConfig, provider: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={editingConfig.modelName}
                  onValueChange={(value) =>
                    setEditingConfig({ ...editingConfig, modelName: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerModels[editingConfig.provider]?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={(editingConfig.config as { temperature?: number }).temperature || 0.7}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      config: { ...editingConfig.config, temperature: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  min="100"
                  max="128000"
                  value={(editingConfig.config as { maxTokens?: number }).maxTokens || 4096}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      config: { ...editingConfig.config, maxTokens: parseInt(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDefaultConfigs(): ModelConfig[] {
  return [
    { role: "composer", provider: "openai", modelName: "gpt-5.2", config: { temperature: 0.7, maxTokens: 4096 } },
    { role: "composer_fast", provider: "openai", modelName: "gpt-5-mini", config: { temperature: 0.7, maxTokens: 2048 } },
    { role: "planner", provider: "openai", modelName: "gpt-5-mini", config: { temperature: 0.3, maxTokens: 1024 } },
    { role: "reflection", provider: "openai", modelName: "gpt-5.2", config: { temperature: 0.5, maxTokens: 2048 } },
    { role: "mode_classifier", provider: "openai", modelName: "gpt-5-mini", config: { temperature: 0.1, maxTokens: 256 } },
    { role: "memory_extractor", provider: "openai", modelName: "gpt-5-mini", config: { temperature: 0.3, maxTokens: 1024 } },
    { role: "embeddings", provider: "openai", modelName: "text-embedding-3-large", config: { dimensions: 1536 } },
    { role: "image_generation", provider: "openai", modelName: "gpt-image-1.5", config: { size: "1024x1024", quality: "medium" } },
    { role: "research", provider: "openai", modelName: "o3-deep-research", config: { temperature: 0.7, maxTokens: 16384 } },
  ];
}
