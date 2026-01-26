"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChatMessages, type ChatMessage, type ImageGenerationData } from "@/components/chat/chat-messages";
import { ChatInput, type FileAttachment, type ImageGenerationSettings } from "@/components/chat/chat-input";
import { SessionPane, type Session } from "@/components/chat/session-pane";
import { ReasoningPane } from "@/components/chat/reasoning-pane";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Zap, Brain, Sparkles, Search, Plus, Globe, Wand2, Activity } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { AgentEvent, ModeClassification } from "@/lib/chat/types";

type ChatMode = "auto" | "quick" | "think" | "deep" | "research";

const modeConfig: Record<ChatMode, { icon: React.ReactNode; label: string; description: string }> = {
  auto: { icon: <Wand2 className="h-4 w-4" />, label: "Auto", description: "Auto-detect mode" },
  quick: { icon: <Zap className="h-4 w-4" />, label: "Quick", description: "Fast responses" },
  think: { icon: <Brain className="h-4 w-4" />, label: "Think", description: "Balanced analysis" },
  deep: { icon: <Sparkles className="h-4 w-4" />, label: "Deep", description: "Comprehensive" },
  research: { icon: <Search className="h-4 w-4" />, label: "Research", description: "In-depth research" },
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("auto");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionPaneOpen, setSessionPaneOpen] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Trace/debug panel state - enabled by default so users see agent steps
  const [tracePaneOpen, setTracePaneOpen] = useState(true);
  const [traceMinimized, setTraceMinimized] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [modeClassification, setModeClassification] = useState<ModeClassification | null>(null);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<Exclude<ChatMode, 'auto'>>('think');

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  // Create a new session
  const createSession = async (title: string = "New Chat"): Promise<string | null> => {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const data = await response.json();
        await fetchSessions();
        return data.id;
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
    return null;
  };

  // Load messages for a session
  const loadSessionMessages = async (sessionIdToLoad: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionIdToLoad}/messages`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: ChatMessage[] = data.map((m: {
          id: string;
          role: string;
          content: string;
          metadata: Record<string, unknown>;
          createdAt: string;
          imageGeneration?: {
            isGenerating: boolean;
            progress: number;
            partialImages: { index: number; imageBase64: string }[];
            finalImage?: string;
            revisedPrompt?: string;
            quality?: string;
            size?: string;
            background?: string;
            durationMs?: number;
          };
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt),
          attachments: m.metadata?.attachments as FileAttachment[] | undefined,
          // Restore image generation data if present
          imageGeneration: m.imageGeneration,
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  // Save a message to the session
  const saveMessage = async (sessionIdToSave: string, role: string, content: string, metadata?: Record<string, unknown>) => {
    try {
      await fetch(`/api/sessions/${sessionIdToSave}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, metadata }),
      });
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  };

  // Generate title from first message (30 char limit)
  const generateTitleFromMessage = (message: string): string => {
    let title = message.trim();
    
    // Take first sentence or first 30 chars
    const sentenceEnd = title.search(/[.!?]/);
    if (sentenceEnd > 0 && sentenceEnd <= 30) {
      title = title.substring(0, sentenceEnd + 1);
    } else if (title.length > 30) {
      // Truncate at word boundary if possible
      title = title.substring(0, 30);
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 20) {
        title = title.substring(0, lastSpace);
      }
      title = title.trimEnd() + "...";
    }
    
    return title;
  };

  // Handle session selection
  const handleSessionSelect = useCallback(async (session: Session) => {
    if (session.id === sessionId) return;
    
    setSessionId(session.id);
    setAttachments([]);
    setImageMode(false);
    await loadSessionMessages(session.id);
  }, [sessionId]);

  // Handle new chat - just clear state, session created on first message
  const handleNewChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setAttachments([]);
    setImageMode(false);
  }, []);

  // Handle image upload for editing
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.fileId;
  }, [sessionId]);

  const handleSubmit = useCallback(async (message: string, imageSettings?: ImageGenerationSettings) => {
    if (!message.trim()) return;

    // Create session lazily on first message
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const title = generateTitleFromMessage(message);
      const newId = await createSession(title);
      if (!newId) {
        console.error("Failed to create session");
        return;
      }
      currentSessionId = newId;
      setSessionId(newId);
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setAttachments([]);
    setIsLoading(true);

    // Save user message to database
    await saveMessage(currentSessionId, "user", message, 
      attachments.length > 0 ? { attachments } : undefined);

    // Create assistant message placeholder
    const assistantMessageId = uuidv4();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
      // Initialize image generation data if in image mode
      imageGeneration: imageSettings ? {
        isGenerating: true,
        progress: 0,
        partialImages: [],
        startTime: Date.now(),
      } : undefined,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      // Handle image generation mode
      if (imageSettings) {
        const imageResponse = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: message,
            sessionId: currentSessionId,
            quality: imageSettings.quality,
            size: imageSettings.size,
            background: imageSettings.transparentBackground ? 'transparent' : 'opaque',
            inputImages: imageSettings.inputImages
              .filter(img => img.fileId)
              .map(img => ({ type: 'file_id', value: img.fileId })),
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!imageResponse.ok) {
          throw new Error(`HTTP error! status: ${imageResponse.status}`);
        }

        // Handle streaming image response
        const reader = imageResponse.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        // Buffer for incomplete SSE messages (data can be chunked across reads)
        let sseBuffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          sseBuffer += decoder.decode(value, { stream: true });
          
          // Process complete SSE messages (those ending with \n\n)
          // SSE format: "data: {...}\n\n"
          const messages = sseBuffer.split('\n\n');
          
          // Keep the last part in buffer if it's incomplete (no trailing \n\n)
          sseBuffer = messages.pop() || '';

          for (const message of messages) {
            const lines = message.split('\n');
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === 'partial') {
                    // Update with partial image
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              imageGeneration: {
                                ...m.imageGeneration!,
                                progress: parsed.progress || 0,
                                partialImages: [
                                  ...(m.imageGeneration?.partialImages || []),
                                  { index: parsed.partialIndex, imageBase64: parsed.imageBase64 },
                                ],
                              },
                            }
                          : m
                      )
                    );
                  } else if (parsed.type === 'complete') {
                    // Update with final image
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              isStreaming: false,
                              imageGeneration: {
                                ...m.imageGeneration!,
                                isGenerating: false,
                                progress: 100,
                                finalImage: parsed.imageBase64,
                                revisedPrompt: parsed.revisedPrompt,
                                quality: parsed.quality,
                                size: parsed.size,
                                background: parsed.background,
                                durationMs: parsed.durationMs,
                              },
                            }
                          : m
                      )
                    );
                  } else if (parsed.type === 'error') {
                    throw new Error(parsed.error);
                  }
                } catch (e) {
                  if (e instanceof SyntaxError) {
                    // Incomplete JSON, ignore
                  } else {
                    throw e;
                  }
                }
              }
            }
          }
        }

        // Save assistant message with image reference
        await saveMessage(currentSessionId, "assistant", "", {
          imageGeneration: true,
          prompt: message,
        });
      } else {
        // Clear previous trace data
        setAgentEvents([]);
        setModeClassification(null);
        setCurrentTurnId(null);
        
        // Regular chat flow - include full attachment data with extracted content
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId: currentSessionId,
            mode,
            imageMode: false,
            webEnabled,
            enableTrace: tracePaneOpen, // Enable trace events if pane is open
            attachments: attachments
              .filter((a) => a.status === 'ready')
              .map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                extractedContent: a.extractedContent,
                imageData: a.imageData,
              })),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                
                // Handle different event types
                if (parsed.type === 'content') {
                  // Content chunk
                  fullContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                } else if (parsed.type === 'mode') {
                  // Mode classification result
                  setModeClassification(parsed.classification);
                  setEffectiveMode(parsed.classification.recommendedMode);
                  if (parsed.turnId) {
                    setCurrentTurnId(parsed.turnId);
                  }
                } else if (parsed.type === 'agent') {
                  // Agent event for trace
                  setAgentEvents((prev) => [...prev, parsed.event]);
                } else if (parsed.type === 'evaluation') {
                  // Evaluation ready - store turnId for display
                  if (parsed.turnId) {
                    setCurrentTurnId(parsed.turnId);
                    // Update the message with turnId for evaluation display
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, turnId: parsed.turnId, effectiveMode: effectiveMode }
                          : m
                      )
                    );
                  }
                } else if (parsed.content) {
                  // Legacy format - just content
                  fullContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                }
              } catch {
                // Not JSON, treat as plain text (legacy)
                fullContent += data;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            }
          }
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m
          )
        );

        // Save assistant message to database
        await saveMessage(currentSessionId, "assistant", fullContent);
      }
      
      // Refresh sessions to update timestamps
      await fetchSessions();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("Request aborted");
      } else {
        console.error("Chat error:", error);
        const errorContent = "Sorry, there was an error processing your request. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: errorContent,
                  isStreaming: false,
                  imageGeneration: m.imageGeneration ? {
                    ...m.imageGeneration,
                    isGenerating: false,
                  } : undefined,
                }
              : m
          )
        );
        // Save error message to database
        await saveMessage(currentSessionId, "assistant", errorContent);
      }
    } finally {
      setIsLoading(false);
      setImageMode(false);
    }
  }, [sessionId, mode, webEnabled, attachments, tracePaneOpen]);

  const handleFileSelect = useCallback(async (files: FileList) => {
    // Process each file asynchronously
    for (const file of Array.from(files)) {
      const attachmentId = uuidv4();
      
      // Add attachment with uploading status
      const initialAttachment: FileAttachment = {
        id: attachmentId,
        name: file.name,
        type: file.type,
        size: file.size,
        status: "uploading",
      };
      setAttachments((prev) => [...prev, initialAttachment]);
      
      try {
        // Upload to file processing API
        const formData = new FormData();
        formData.append('file', file);
        
        // Update to processing status
        setAttachments((prev) => 
          prev.map((a) => a.id === attachmentId ? { ...a, status: "processing" as const } : a)
        );
        
        const response = await fetch('/api/file-process', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Update attachment with extracted content
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? {
                    ...a,
                    status: "ready" as const,
                    extractedContent: result.data.extractedContent,
                    imageData: result.data.imageData,
                  }
                : a
            )
          );
        } else {
          // Handle error
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? {
                    ...a,
                    status: "error" as const,
                    error: result.error || 'Failed to process file',
                  }
                : a
            )
          );
        }
      } catch (error) {
        // Handle network or other errors
        console.error('File processing error:', error);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? {
                  ...a,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : 'Failed to process file',
                }
              : a
          )
        );
      }
    }
  }, []);

  const handleFileRemove = useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== fileId));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Session Pane */}
      <SessionPane
        sessions={sessions}
        currentSessionId={sessionId}
        isOpen={sessionPaneOpen}
        onToggle={() => setSessionPaneOpen(!sessionPaneOpen)}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewChat}
        onSessionsChange={fetchSessions}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="font-semibold">Chat</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Trace toggle */}
            <Button 
              variant={tracePaneOpen ? "default" : "outline"} 
              size="sm" 
              onClick={() => setTracePaneOpen(!tracePaneOpen)}
              title="Toggle agent trace"
            >
              <Activity className="h-4 w-4" />
            </Button>

            {/* New chat button */}
            <Button variant="outline" size="sm" onClick={handleNewChat}>
              <Plus className="h-4 w-4 mr-1" />
              New Chat
            </Button>
          </div>
        </header>

        {/* Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Mode and Web Controls - above input */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Web search toggle */}
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground hidden sm:inline">Web</span>
                  <Switch 
                    checked={webEnabled} 
                    onCheckedChange={setWebEnabled}
                    disabled={isLoading}
                  />
                </div>

                {/* Mode selector */}
                <Select value={mode} onValueChange={(v) => setMode(v as ChatMode)} disabled={isLoading}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {modeConfig[mode].icon}
                        <span>{modeConfig[mode].label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <div>
                            <div>{config.label}</div>
                            <div className="text-xs text-muted-foreground">{config.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chat Input */}
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              disabled={isLoading}
              attachments={attachments}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              onImageModeToggle={() => setImageMode(!imageMode)}
              imageMode={imageMode}
              onImageUpload={handleImageUpload}
              sessionId={sessionId || undefined}
              placeholder="Ask anything about your business data..."
            />
          </div>
        </div>
      </div>

      {/* Reasoning/Trace Pane */}
      {tracePaneOpen && (
        <div className={`${traceMinimized ? 'w-16' : 'w-80'} flex-shrink-0 transition-all duration-200`}>
          <ReasoningPane
            isVisible={true}
            onClose={() => setTracePaneOpen(false)}
            isProcessing={isLoading}
            isMinimized={traceMinimized}
            onToggleMinimized={() => setTraceMinimized(!traceMinimized)}
            agentEvents={agentEvents}
            modeClassification={modeClassification}
          />
        </div>
      )}
    </div>
  );
}
