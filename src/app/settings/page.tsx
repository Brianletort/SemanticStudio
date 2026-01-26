"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ThemeSelector } from "@/components/theme-toggle";
import {
  User,
  Palette,
  MessageSquare,
  Brain,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Save,
  Check,
  X,
  Sun,
  Moon,
  Monitor,
  FolderKanban,
  Pin,
} from "lucide-react";
import { toast } from "sonner";

interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  nickname: string | null;
  occupation: string | null;
  aboutMe: string | null;
  conversationStyle: string;
  characteristics: Record<string, boolean>;
  // Memory configuration
  memoryEnabled: boolean;
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  autoSaveMemories: boolean;
  memoryExtractionMode: string;
  maxMemoriesInContext: number;
  includeSessionSummaries: boolean;
  // Chat organization
  maxPinnedSessions: number;
  createdAt: string;
  updatedAt: string;
}

interface Memory {
  id: string;
  userId: string;
  content: string;
  source: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const conversationStyles = [
  { value: "professional", label: "Professional", description: "Formal, business-appropriate" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "candid", label: "Candid", description: "Direct and honest" },
  { value: "efficient", label: "Efficient", description: "Brief and to the point" },
  { value: "quirky", label: "Quirky", description: "Playful and creative" },
  { value: "nerdy", label: "Nerdy", description: "Technical and detailed" },
  { value: "cynical", label: "Cynical", description: "Dry humor, realistic" },
];

const characteristicOptions = [
  { key: "use_emojis", label: "Use emojis", description: "Include emojis in responses" },
  { key: "use_headers", label: "Use headers/lists", description: "Structure responses with headers and lists" },
  { key: "enthusiastic", label: "Enthusiastic", description: "Upbeat and energetic tone" },
  { key: "formal", label: "Formal language", description: "Use formal language patterns" },
  { key: "detailed", label: "Detailed responses", description: "Provide comprehensive explanations" },
];

const memoryExtractionModes = [
  { value: "conservative", label: "Conservative", description: "Only save explicitly important facts" },
  { value: "balanced", label: "Balanced", description: "Balance between saving useful facts" },
  { value: "aggressive", label: "Aggressive", description: "Save as many relevant facts as possible" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [conversationStyle, setConversationStyle] = useState("professional");
  const [characteristics, setCharacteristics] = useState<Record<string, boolean>>({
    use_emojis: false,
    use_headers: true,
    enthusiastic: false,
    formal: false,
    detailed: true,
  });

  // Memory configuration state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [referenceSavedMemories, setReferenceSavedMemories] = useState(true);
  const [referenceChatHistory, setReferenceChatHistory] = useState(true);
  const [autoSaveMemories, setAutoSaveMemories] = useState(false);
  const [memoryExtractionMode, setMemoryExtractionMode] = useState("balanced");
  const [maxMemoriesInContext, setMaxMemoriesInContext] = useState(10);
  const [includeSessionSummaries, setIncludeSessionSummaries] = useState(false);

  // Chat organization state
  const [maxPinnedSessions, setMaxPinnedSessions] = useState(10);

  // Memory dialog state
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [memoryContent, setMemoryContent] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, memoriesRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/memories"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
        setNickname(data.nickname || "");
        setOccupation(data.occupation || "");
        setAboutMe(data.aboutMe || "");
        setConversationStyle(data.conversationStyle || "professional");
        setCharacteristics(data.characteristics || {});
        // Memory configuration
        setMemoryEnabled(data.memoryEnabled ?? true);
        setReferenceSavedMemories(data.referenceSavedMemories ?? true);
        setReferenceChatHistory(data.referenceChatHistory ?? true);
        setAutoSaveMemories(data.autoSaveMemories ?? false);
        setMemoryExtractionMode(data.memoryExtractionMode || "balanced");
        setMaxMemoriesInContext(data.maxMemoriesInContext ?? 10);
        setIncludeSessionSummaries(data.includeSessionSummaries ?? false);
        // Chat organization
        setMaxPinnedSessions(data.maxPinnedSessions ?? 10);
        // Sync theme with settings
        if (data.theme && data.theme !== theme) {
          setTheme(data.theme);
        }
      }

      if (memoriesRes.ok) {
        const data = await memoriesRes.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          nickname: nickname || null,
          occupation: occupation || null,
          aboutMe: aboutMe || null,
          conversationStyle,
          characteristics,
          // Memory configuration
          memoryEnabled,
          referenceSavedMemories,
          referenceChatHistory,
          autoSaveMemories,
          memoryExtractionMode,
          maxMemoriesInContext,
          includeSessionSummaries,
          // Chat organization
          maxPinnedSessions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setHasChanges(false);
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setHasChanges(true);
  };

  const handleAddMemory = async () => {
    if (!memoryContent.trim()) return;

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoryContent }),
      });

      if (response.ok) {
        const memory = await response.json();
        setMemories([memory, ...memories]);
        setMemoryContent("");
        setMemoryDialogOpen(false);
        toast.success("Memory added");
      }
    } catch (error) {
      console.error("Failed to add memory:", error);
      toast.error("Failed to add memory");
    }
  };

  const handleUpdateMemory = async () => {
    if (!editingMemory || !memoryContent.trim()) return;

    try {
      const response = await fetch("/api/memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingMemory.id, content: memoryContent }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMemories(memories.map((m) => (m.id === updated.id ? updated : m)));
        setEditingMemory(null);
        setMemoryContent("");
        setMemoryDialogOpen(false);
        toast.success("Memory updated");
      }
    } catch (error) {
      console.error("Failed to update memory:", error);
      toast.error("Failed to update memory");
    }
  };

  const handleToggleMemory = async (memory: Memory) => {
    try {
      const response = await fetch("/api/memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memory.id, isActive: !memory.isActive }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMemories(memories.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (error) {
      console.error("Failed to toggle memory:", error);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      const response = await fetch(`/api/memories?id=${memoryId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMemories(memories.filter((m) => m.id !== memoryId));
        toast.success("Memory deleted");
      }
    } catch (error) {
      console.error("Failed to delete memory:", error);
      toast.error("Failed to delete memory");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <h1 className="font-semibold">Settings</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h1 className="font-semibold">Settings</h1>
        </div>
        <Button onClick={handleSaveSettings} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="personalization" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Personalization
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="memory" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Memory
              </TabsTrigger>
              <TabsTrigger value="memories" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Saved Memories
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Tell us about yourself so the AI can personalize responses
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      placeholder="How should I address you?"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        setHasChanges(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      The AI will use this name when addressing you
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      placeholder="What do you do?"
                      value={occupation}
                      onChange={(e) => {
                        setOccupation(e.target.value);
                        setHasChanges(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Helps the AI tailor technical depth and examples
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aboutMe">About You</Label>
                    <Textarea
                      id="aboutMe"
                      placeholder="Tell me about your interests, goals, or anything else..."
                      value={aboutMe}
                      onChange={(e) => {
                        setAboutMe(e.target.value);
                        setHasChanges(true);
                      }}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Additional context to help personalize responses
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize how the application looks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Theme</Label>
                    <ThemeSelector value={theme || "system"} onChange={handleThemeChange} />
                    <p className="text-xs text-muted-foreground">
                      Choose between light, dark, or system theme
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Personalization Tab */}
            <TabsContent value="personalization">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Conversation Style</CardTitle>
                    <CardDescription>
                      How should the AI communicate with you?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {conversationStyles.map((style) => (
                        <Button
                          key={style.value}
                          variant={conversationStyle === style.value ? "default" : "outline"}
                          className="h-auto min-h-[70px] py-3 px-3 flex flex-col items-start justify-start text-left whitespace-normal"
                          onClick={() => {
                            setConversationStyle(style.value);
                            setHasChanges(true);
                          }}
                        >
                          <span className="font-medium text-sm">{style.label}</span>
                          <span className="text-xs text-muted-foreground font-normal leading-tight">
                            {style.description}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Characteristics</CardTitle>
                    <CardDescription>
                      Fine-tune how responses are formatted
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {characteristicOptions.map((option) => (
                      <div
                        key={option.key}
                        className="flex items-center justify-between py-2"
                      >
                        <div>
                          <Label htmlFor={option.key}>{option.label}</Label>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        <Switch
                          id={option.key}
                          checked={characteristics[option.key] || false}
                          onCheckedChange={(checked) => {
                            setCharacteristics({ ...characteristics, [option.key]: checked });
                            setHasChanges(true);
                          }}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Chat Organization Tab */}
            <TabsContent value="chat">
              <Card>
                <CardHeader>
                  <CardTitle>Chat Organization</CardTitle>
                  <CardDescription>
                    Configure how your chat sessions are organized
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Max pinned sessions */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="maxPinnedSessions">Maximum pinned sessions</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        id="maxPinnedSessions"
                        type="number"
                        min={1}
                        max={50}
                        value={maxPinnedSessions}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 10;
                          setMaxPinnedSessions(Math.min(50, Math.max(1, value)));
                          setHasChanges(true);
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        sessions (1-50)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The maximum number of chat sessions you can pin to the top of the list. 
                      Pinned sessions are always visible for quick access.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Memory Configuration Tab */}
            <TabsContent value="memory">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Memory System</CardTitle>
                    <CardDescription>
                      Control how the AI remembers and uses context across conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Master toggle */}
                    <div className="flex items-center justify-between py-2 border-b">
                      <div>
                        <Label htmlFor="memoryEnabled" className="text-base font-medium">
                          Enable memory system
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Let AgentKit remember context across conversations
                        </p>
                      </div>
                      <Switch
                        id="memoryEnabled"
                        checked={memoryEnabled}
                        onCheckedChange={(checked) => {
                          setMemoryEnabled(checked);
                          setHasChanges(true);
                        }}
                      />
                    </div>

                    {/* Reference saved memories */}
                    <div className={`flex items-center justify-between py-2 ${!memoryEnabled ? "opacity-50" : ""}`}>
                      <div>
                        <Label htmlFor="referenceSavedMemories">Reference saved memories</Label>
                        <p className="text-sm text-muted-foreground">
                          Use your saved memories when responding
                        </p>
                      </div>
                      <Switch
                        id="referenceSavedMemories"
                        checked={referenceSavedMemories}
                        disabled={!memoryEnabled}
                        onCheckedChange={(checked) => {
                          setReferenceSavedMemories(checked);
                          setHasChanges(true);
                        }}
                      />
                    </div>

                    {/* Reference chat history */}
                    <div className={`flex items-center justify-between py-2 ${!memoryEnabled ? "opacity-50" : ""}`}>
                      <div>
                        <Label htmlFor="referenceChatHistory">Reference chat history</Label>
                        <p className="text-sm text-muted-foreground">
                          Reference previous conversations when relevant
                        </p>
                      </div>
                      <Switch
                        id="referenceChatHistory"
                        checked={referenceChatHistory}
                        disabled={!memoryEnabled}
                        onCheckedChange={(checked) => {
                          setReferenceChatHistory(checked);
                          setHasChanges(true);
                        }}
                      />
                    </div>

                    {/* Auto-save memories */}
                    <div className={`flex items-center justify-between py-2 ${!memoryEnabled ? "opacity-50" : ""}`}>
                      <div>
                        <Label htmlFor="autoSaveMemories">Auto-save memories</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically save important facts from conversations
                        </p>
                      </div>
                      <Switch
                        id="autoSaveMemories"
                        checked={autoSaveMemories}
                        disabled={!memoryEnabled}
                        onCheckedChange={(checked) => {
                          setAutoSaveMemories(checked);
                          setHasChanges(true);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Options</CardTitle>
                    <CardDescription>
                      Fine-tune memory behavior
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Memory extraction mode */}
                    <div className={`space-y-2 ${!memoryEnabled || !autoSaveMemories ? "opacity-50" : ""}`}>
                      <Label>Memory extraction sensitivity</Label>
                      <Select
                        value={memoryExtractionMode}
                        disabled={!memoryEnabled || !autoSaveMemories}
                        onValueChange={(value) => {
                          setMemoryExtractionMode(value);
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {memoryExtractionModes.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              <div>
                                <div className="font-medium">{mode.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {mode.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        How aggressively to extract and save facts from conversations
                      </p>
                    </div>

                    {/* Max memories in context */}
                    <div className={`space-y-2 ${!memoryEnabled ? "opacity-50" : ""}`}>
                      <Label htmlFor="maxMemories">Max memories per response</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="maxMemories"
                          type="number"
                          min={1}
                          max={50}
                          value={maxMemoriesInContext}
                          disabled={!memoryEnabled}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 10;
                            setMaxMemoriesInContext(Math.min(50, Math.max(1, value)));
                            setHasChanges(true);
                          }}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          memories included in each response
                        </span>
                      </div>
                    </div>

                    {/* Include session summaries */}
                    <div className={`flex items-center justify-between py-2 ${!memoryEnabled ? "opacity-50" : ""}`}>
                      <div>
                        <Label htmlFor="includeSessionSummaries">Include session summaries</Label>
                        <p className="text-sm text-muted-foreground">
                          Reference summaries from past conversation sessions
                        </p>
                      </div>
                      <Switch
                        id="includeSessionSummaries"
                        checked={includeSessionSummaries}
                        disabled={!memoryEnabled}
                        onCheckedChange={(checked) => {
                          setIncludeSessionSummaries(checked);
                          setHasChanges(true);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Saved Memories Tab */}
            <TabsContent value="memories">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Memories</CardTitle>
                      <CardDescription>
                        Things the AI will remember about you across conversations
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingMemory(null);
                        setMemoryContent("");
                        setMemoryDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Memory
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {memories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No memories yet</p>
                      <p className="text-sm">
                        Add memories to help the AI remember important things about you
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memories.map((memory) => (
                        <div
                          key={memory.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            memory.isActive ? "bg-background" : "bg-muted/50 opacity-60"
                          }`}
                        >
                          <Switch
                            checked={memory.isActive}
                            onCheckedChange={() => handleToggleMemory(memory)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{memory.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {memory.source}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(memory.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingMemory(memory);
                                setMemoryContent(memory.content);
                                setMemoryDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteMemory(memory.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Memory Dialog */}
      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMemory ? "Edit Memory" : "Add Memory"}
            </DialogTitle>
            <DialogDescription>
              {editingMemory
                ? "Update this memory"
                : "Add something you want the AI to remember"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g., I prefer concise responses, I'm allergic to peanuts, I work in healthcare..."
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingMemory ? handleUpdateMemory : handleAddMemory}
              disabled={!memoryContent.trim()}
            >
              {editingMemory ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
