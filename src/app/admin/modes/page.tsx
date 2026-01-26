"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Save, Zap, Brain, Layers, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { ModePipelineFlow } from "@/components/admin/mode-pipeline-flow";

// Types
interface ModeConfig {
  maxResults: number;
  useGraph: boolean;
  graphHops: number;
  webResultsIfEnabled: number;
  memoryTiers: string[];
  enableReflection: boolean;
  enableClarification: boolean;
  composerRole: string;
  showEvaluationByDefault: boolean;
  description: string;
  isModified: boolean;
}

interface MemoryTierConfig {
  tier1WorkingContext: boolean;
  tier2SessionMemory: boolean;
  tier3LongTermMemory: boolean;
}

interface PipelineConfig {
  enableReflection: boolean;
  enableClarification: boolean;
  showEvaluationInChat: boolean;
  autoModeDefault: string;
}

interface ModeConfigResponse {
  modes: {
    quick: ModeConfig;
    think: ModeConfig;
    deep: ModeConfig;
    research: ModeConfig;
  };
  globalSettings: {
    memoryTierConfig: MemoryTierConfig;
    pipelineConfig: PipelineConfig;
  };
  defaults: {
    modes: Record<string, ModeConfig>;
    memoryTierConfig: MemoryTierConfig;
    pipelineConfig: PipelineConfig;
  };
  availableModels: Array<{ role: string; modelName: string; provider: string }>;
}

type ModeName = 'quick' | 'think' | 'deep' | 'research';

const modeIcons: Record<ModeName, React.ReactNode> = {
  quick: <Zap className="w-4 h-4" />,
  think: <Brain className="w-4 h-4" />,
  deep: <Layers className="w-4 h-4" />,
  research: <Search className="w-4 h-4" />,
};

const modeDescriptions: Record<ModeName, string> = {
  quick: 'Fast responses for simple questions',
  think: 'Balanced analysis with reflection',
  deep: 'Comprehensive graph traversal',
  research: 'In-depth research with clarification',
};

export default function ModeConfigPage() {
  const [data, setData] = useState<ModeConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeName>('think');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Local edits state
  const [modeEdits, setModeEdits] = useState<Record<ModeName, Partial<ModeConfig>>>({
    quick: {},
    think: {},
    deep: {},
    research: {},
  });
  const [globalEdits, setGlobalEdits] = useState<{
    memoryTierConfig?: Partial<MemoryTierConfig>;
    pipelineConfig?: Partial<PipelineConfig>;
  }>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/admin/mode-config");
      if (response.ok) {
        const configData = await response.json();
        setData(configData);
      } else {
        toast.error("Failed to load mode configuration");
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Failed to load mode configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build overrides from edits
      const modeOverrides: Record<string, Partial<ModeConfig>> = {};
      for (const mode of ['quick', 'think', 'deep', 'research'] as ModeName[]) {
        if (Object.keys(modeEdits[mode]).length > 0) {
          modeOverrides[mode] = modeEdits[mode];
        }
      }

      const response = await fetch("/api/admin/mode-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modeOverrides: Object.keys(modeOverrides).length > 0 ? modeOverrides : undefined,
          memoryTierConfig: globalEdits.memoryTierConfig,
          pipelineConfig: globalEdits.pipelineConfig,
        }),
      });

      if (response.ok) {
        toast.success("Mode configuration saved");
        setHasChanges(false);
        await fetchConfig();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/mode-config", {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Configuration reset to defaults");
        setModeEdits({ quick: {}, think: {}, deep: {}, research: {} });
        setGlobalEdits({});
        setHasChanges(false);
        await fetchConfig();
      } else {
        toast.error("Failed to reset configuration");
      }
    } catch (error) {
      console.error("Error resetting config:", error);
      toast.error("Failed to reset configuration");
    } finally {
      setSaving(false);
    }
  };

  const updateModeConfig = (mode: ModeName, key: keyof ModeConfig, value: unknown) => {
    setModeEdits(prev => ({
      ...prev,
      [mode]: { ...prev[mode], [key]: value },
    }));
    setHasChanges(true);
  };

  const updateGlobalConfig = (
    section: 'memoryTierConfig' | 'pipelineConfig',
    key: string,
    value: unknown
  ) => {
    setGlobalEdits(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
    setHasChanges(true);
  };

  // Get effective config (current + edits)
  const getEffectiveConfig = (mode: ModeName): ModeConfig => {
    if (!data) return {} as ModeConfig;
    return { ...data.modes[mode], ...modeEdits[mode] };
  };

  const getEffectiveGlobalConfig = () => {
    if (!data) return { memoryTierConfig: {} as MemoryTierConfig, pipelineConfig: {} as PipelineConfig };
    return {
      memoryTierConfig: { ...data.globalSettings.memoryTierConfig, ...globalEdits.memoryTierConfig },
      pipelineConfig: { ...data.globalSettings.pipelineConfig, ...globalEdits.pipelineConfig },
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <h1 className="font-semibold">Mode Configuration</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <h1 className="font-semibold">Mode Configuration</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Failed to load configuration</p>
        </div>
      </div>
    );
  }

  const effectiveConfig = getEffectiveConfig(activeMode);
  const effectiveGlobal = getEffectiveGlobalConfig();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h1 className="font-semibold">Mode Configuration</h1>
          {hasChanges && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Mode Tabs */}
          <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as ModeName)}>
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              {(['quick', 'think', 'deep', 'research'] as ModeName[]).map((mode) => (
                <TabsTrigger key={mode} value={mode} className="capitalize">
                  <span className="flex items-center gap-2">
                    {modeIcons[mode]}
                    {mode}
                    {data.modes[mode].isModified && (
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {(['quick', 'think', 'deep', 'research'] as ModeName[]).map((mode) => (
              <TabsContent key={mode} value={mode} className="space-y-6 mt-6">
                {/* Pipeline Flow Visualization */}
                <ModePipelineFlow
                  mode={mode}
                  config={getEffectiveConfig(mode)}
                  webEnabled={true}
                />

                {/* Settings Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Retrieval Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Retrieval Settings</CardTitle>
                      <CardDescription>Configure data retrieval behavior</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${mode}-maxResults`}>
                          Max Results
                          <span className="text-xs text-muted-foreground ml-2">
                            (Default: {data.defaults.modes[mode].maxResults})
                          </span>
                        </Label>
                        <Input
                          id={`${mode}-maxResults`}
                          type="number"
                          min={1}
                          max={100}
                          value={getEffectiveConfig(mode).maxResults}
                          onChange={(e) => updateModeConfig(mode, 'maxResults', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum chunks/rows to retrieve (1-100)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${mode}-graphHops`}>
                          Graph Hops
                          <span className="text-xs text-muted-foreground ml-2">
                            (Default: {data.defaults.modes[mode].graphHops})
                          </span>
                        </Label>
                        <Select
                          value={String(getEffectiveConfig(mode).graphHops)}
                          onValueChange={(v) => updateModeConfig(mode, 'graphHops', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 - Entity match only</SelectItem>
                            <SelectItem value="1">1 - Direct relationships</SelectItem>
                            <SelectItem value="2">2 - Two-hop expansion</SelectItem>
                            <SelectItem value="3">3 - Full traversal</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Knowledge graph traversal depth
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${mode}-webResults`}>
                          Web Results (when enabled)
                          <span className="text-xs text-muted-foreground ml-2">
                            (Default: {data.defaults.modes[mode].webResultsIfEnabled})
                          </span>
                        </Label>
                        <Input
                          id={`${mode}-webResults`}
                          type="number"
                          min={1}
                          max={20}
                          value={getEffectiveConfig(mode).webResultsIfEnabled}
                          onChange={(e) => updateModeConfig(mode, 'webResultsIfEnabled', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Web search results when toggle is on (1-20)
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Memory Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Memory Tiers</CardTitle>
                      <CardDescription>Configure which memory tiers to use</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Tier 1: Working Context</Label>
                          <p className="text-xs text-muted-foreground">
                            Recent conversation turns
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.memoryTierConfig.tier1WorkingContext}
                          disabled
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Tier 2: Session Memory</Label>
                          <p className="text-xs text-muted-foreground">
                            Facts from current session
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.memoryTierConfig.tier2SessionMemory}
                          onCheckedChange={(v) => updateGlobalConfig('memoryTierConfig', 'tier2SessionMemory', v)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Tier 3: Long-Term Memory</Label>
                          <p className="text-xs text-muted-foreground">
                            User profile facts across sessions
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.memoryTierConfig.tier3LongTermMemory}
                          onCheckedChange={(v) => updateGlobalConfig('memoryTierConfig', 'tier3LongTermMemory', v)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pipeline Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pipeline Settings</CardTitle>
                      <CardDescription>Configure pipeline behavior</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Reflection</Label>
                          <p className="text-xs text-muted-foreground">
                            Review and improve response quality
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.pipelineConfig.enableReflection}
                          onCheckedChange={(v) => updateGlobalConfig('pipelineConfig', 'enableReflection', v)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Clarification</Label>
                          <p className="text-xs text-muted-foreground">
                            Ask follow-up questions (research mode)
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.pipelineConfig.enableClarification}
                          onCheckedChange={(v) => updateGlobalConfig('pipelineConfig', 'enableClarification', v)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Show Evaluation in Chat</Label>
                          <p className="text-xs text-muted-foreground">
                            Display quality scores in UI
                          </p>
                        </div>
                        <Switch
                          checked={effectiveGlobal.pipelineConfig.showEvaluationInChat}
                          onCheckedChange={(v) => updateGlobalConfig('pipelineConfig', 'showEvaluationInChat', v)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Model Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Model Assignment</CardTitle>
                      <CardDescription>Configure which model to use</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Response Model</Label>
                        <Select
                          value={getEffectiveConfig(mode).composerRole}
                          onValueChange={(v) => updateModeConfig(mode, 'composerRole', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {data.availableModels
                              .filter(m => ['composer', 'composer_fast', 'research'].includes(m.role))
                              .map((model) => (
                                <SelectItem key={model.role} value={model.role}>
                                  {model.role} ({model.modelName})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {mode === 'research' 
                            ? 'Uses o3-deep-research for comprehensive analysis'
                            : mode === 'quick'
                            ? 'Uses fast model for quick responses'
                            : 'Model for response generation'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Auto Mode Default</Label>
                        <Select
                          value={effectiveGlobal.pipelineConfig.autoModeDefault}
                          onValueChange={(v) => updateGlobalConfig('pipelineConfig', 'autoModeDefault', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quick">Quick</SelectItem>
                            <SelectItem value="think">Think</SelectItem>
                            <SelectItem value="deep">Deep</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Default mode when auto classification is used
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Mode Description */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium capitalize">{mode} Mode</p>
                        <p className="text-sm text-muted-foreground">
                          {modeDescriptions[mode]}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
