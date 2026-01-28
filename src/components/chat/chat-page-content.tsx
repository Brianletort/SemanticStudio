"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatMessages, type ChatMessage, type ImageGenerationData } from "@/components/chat/chat-messages";
import { ChatInput, type FileAttachment, type ImageGenerationSettings } from "@/components/chat/chat-input";
import { SessionPane, type Session } from "@/components/chat/session-pane";
import { ReasoningPane } from "@/components/chat/reasoning-pane";
import { PromptPicker } from "@/components/chat/prompt-picker";
import { PromptBuilder } from "@/components/chat/prompt-builder";
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
import { toast } from "sonner";
import type { AgentEvent, ModeClassification } from "@/lib/chat/types";
import Link from "next/link";
import { useChatStore } from "@/stores/chat-store";

type ChatMode = "auto" | "quick" | "think" | "deep" | "research";

const modeConfig: Record<ChatMode, { icon: React.ReactNode; label: string; description: string }> = {
  auto: { icon: <Wand2 className="h-4 w-4" />, label: "Auto", description: "Auto-detect mode" },
  quick: { icon: <Zap className="h-4 w-4" />, label: "Quick", description: "Fast responses" },
  think: { icon: <Brain className="h-4 w-4" />, label: "Think", description: "Balanced analysis" },
  deep: { icon: <Sparkles className="h-4 w-4" />, label: "Deep", description: "Comprehensive" },
  research: { icon: <Search className="h-4 w-4" />, label: "Research", description: "In-depth research" },
};

interface ChatPageContentProps {
  initialSessionId?: string;
}

export function ChatPageContent({ initialSessionId }: ChatPageContentProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionPaneOpen, setSessionPaneOpen] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Trace/debug panel state - always visible, can be minimized
  const [traceMinimized, setTraceMinimized] = useState(false);
  const [effectiveMode, setEffectiveMode] = useState<Exclude<ChatMode, 'auto'>>('think');

  // Global store for tracking active sessions across navigation
  // Note: Only use action selectors here - don't subscribe to activeSessions directly
  // as it causes re-renders during streaming that break the UI updates
  const registerActiveSession = useChatStore((state) => state.registerActiveSession);
  const unregisterActiveSession = useChatStore((state) => state.unregisterActiveSession);
  const setSessionStreaming = useChatStore((state) => state.setSessionStreaming);
  const setJustCreatedSessionId = useChatStore((state) => state.setJustCreatedSessionId);
  
  // Trace state actions from Zustand store - persists across navigation
  // Using getState() for actions that don't need to trigger re-renders
  const addSessionAgentEvent = useChatStore((state) => state.addSessionAgentEvent);
  const setSessionModeClassification = useChatStore((state) => state.setSessionModeClassification);
  const setSessionTurnId = useChatStore((state) => state.setSessionTurnId);
  
  // Subscribe to trace state for the current session
  const sessionTraceState = useChatStore((state) => 
    sessionId ? state.sessionTraceState.get(sessionId) : undefined
  );
  const agentEvents = sessionTraceState?.agentEvents ?? [];
  const modeClassification = sessionTraceState?.modeClassification ?? null;
  const currentTurnId = sessionTraceState?.currentTurnId ?? null;
  
  // Session preferences from Zustand store - persist across messages and navigation
  const webEnabled = useChatStore((state) => state.webEnabled);
  const setWebEnabled = useChatStore((state) => state.setWebEnabled);
  const mode = useChatStore((state) => state.mode);
  const setMode = useChatStore((state) => state.setMode);

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
  const loadSessionMessages = useCallback(async (sessionIdToLoad: string) => {
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
          // Restore evaluation and trace data if present
          turnId: m.metadata?.turnId as string | undefined,
          effectiveMode: m.metadata?.effectiveMode as string | undefined,
          // Restore image generation data if present
          imageGeneration: m.imageGeneration,
        }));
        setMessages(loadedMessages);
      } else {
        console.error("Failed to load messages: HTTP", response.status);
        toast.error("Failed to load conversation");
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load conversation");
    }
  }, []);

  // Load messages when initialSessionId changes
  // Also reset trace/agent state to ensure clean state without remounting
  useEffect(() => {
    // Check if we're navigating to the session that was just created
    // (which happens after streaming completes for new chats)
    // Use the global store (not a ref) because it persists across page navigations
    const justCreatedId = useChatStore.getState().justCreatedSessionId;
    const isNavigatingToJustCreatedSession = justCreatedId && initialSessionId === justCreatedId;
    
    if (initialSessionId) {
      setSessionId(initialSessionId);
      loadSessionMessages(initialSessionId);
      
      // Only clear trace state when navigating to a DIFFERENT session
      // Don't clear when navigating to the session that was just created
      if (!isNavigatingToJustCreatedSession) {
        useChatStore.getState().clearSessionTraceState(initialSessionId);
      }
    } else {
      setSessionId(null);
      setMessages([]);
    }
  }, [initialSessionId, loadSessionMessages]);

  // Restore and sync loading state when navigating to an active session
  // Subscribe to streaming state changes so spinner stays in sync
  useEffect(() => {
    if (!sessionId) return;
    
    // Check initial state
    const session = useChatStore.getState().activeSessions.get(sessionId);
    if (session?.isStreaming) {
      setIsLoading(true);
    }
    
    // Subscribe to store changes to keep isLoading in sync with streaming state
    const unsubscribe = useChatStore.subscribe((state) => {
      const currentSession = state.activeSessions.get(sessionId);
      const isStreaming = currentSession?.isStreaming ?? false;
      
      // When streaming stops, update local loading state
      // This handles the case where streaming completes while viewing this session
      // or when we navigate to a session that just finished streaming
      if (!isStreaming && currentSession === undefined) {
        // Session was completely unregistered - streaming is done
        setIsLoading(false);
      } else if (!isStreaming && currentSession !== undefined) {
        // Session still registered but streaming stopped (between [DONE] and unregister)
        setIsLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [sessionId]);

  // Save a message to the session
  const saveMessage = async (sessionIdToSave: string, role: string, content: string, metadata?: Record<string, unknown>): Promise<string | null> => {
    try {
      const response = await fetch(`/api/sessions/${sessionIdToSave}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, metadata }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.id || null;
      }
      return null;
    } catch (error) {
      console.error("Failed to save message:", error);
      return null;
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

  // Handle session selection - navigate to the session URL
  const handleSessionSelect = useCallback((session: Session) => {
    if (session.id === sessionId) return;
    router.push(`/chat/${session.id}`);
  }, [sessionId, router]);

  // Handle new chat - navigate to /chat
  const handleNewChat = useCallback(() => {
    router.push('/chat');
  }, [router]);

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

    // Clear any previous justCreatedSessionId since we're starting a new interaction
    setJustCreatedSessionId(null);
    
    // Create session lazily on first message
    let currentSessionId = sessionId;
    let shouldNavigateAfterStreaming = false;
    if (!currentSessionId) {
      const title = generateTitleFromMessage(message);
      const newId = await createSession(title);
      if (!newId) {
        console.error("Failed to create session");
        return;
      }
      currentSessionId = newId;
      setSessionId(newId);
      // Store in global state so we know this session was created locally
      // This persists across page navigation unlike refs
      setJustCreatedSessionId(newId);
      // Don't navigate yet - it causes remount and breaks streaming
      // We'll navigate after streaming completes
      shouldNavigateAfterStreaming = true;
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
      
      // Register this session as active in global store (non-critical)
      try {
        registerActiveSession(currentSessionId, abortControllerRef.current);
      } catch (e) {
        console.warn('Failed to register active session:', e);
      }

      // Handle image generation mode
      if (imageSettings) {
        // Save assistant message FIRST to get the database-generated message ID
        // This ensures proper linkage between the message and the generated image
        const savedMessageId = await saveMessage(currentSessionId, "assistant", "", {
          imageGeneration: true,
          prompt: message,
        });

        const imageResponse = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: message,
            sessionId: currentSessionId,
            messageId: savedMessageId, // Pass the message ID for proper linkage
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
                if (data === "[DONE]") {
                  // Stream complete - update global store immediately
                  try {
                    setSessionStreaming(currentSessionId, false);
                  } catch (e) {
                    console.warn('Failed to set session streaming state:', e);
                  }
                  continue;
                }

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
        // Note: Assistant message was already saved at the start of image generation
        // to ensure proper messageId linkage with the generated image
      } else {
        // Clear previous trace data for this session
        if (currentSessionId) {
          useChatStore.getState().clearSessionTraceState(currentSessionId);
        }
        
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
            enableTrace: true, // Always enable trace events
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
        // Buffer for incomplete SSE messages (data can be chunked across reads)
        let sseBuffer = '';
        // Track turnId and effectiveMode for persistence
        let messageTurnId: string | null = null;
        let messageEffectiveMode: string | undefined = undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          sseBuffer += decoder.decode(value, { stream: true });
          
          // Process complete SSE messages (those ending with \n\n)
          // SSE format: "data: {...}\n\n"
          const sseMessages = sseBuffer.split('\n\n');
          
          // Keep the last part in buffer if it's incomplete (no trailing \n\n)
          sseBuffer = sseMessages.pop() || '';

          for (const sseMessage of sseMessages) {
            const lines = sseMessage.split('\n');
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  // Stream complete - update global store immediately
                  // This ensures spinners stop even if user navigated away
                  try {
                    setSessionStreaming(currentSessionId, false);
                  } catch (e) {
                    console.warn('Failed to set session streaming state:', e);
                  }
                  continue;
                }

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
                    if (currentSessionId) {
                      setSessionModeClassification(currentSessionId, parsed.classification);
                    }
                    setEffectiveMode(parsed.classification.recommendedMode);
                    if (parsed.turnId && currentSessionId) {
                      setSessionTurnId(currentSessionId, parsed.turnId);
                    }
                  } else if (parsed.type === 'agent') {
                    // Agent event for trace
                    if (currentSessionId) {
                      addSessionAgentEvent(currentSessionId, parsed.event);
                    }
                  } else if (parsed.type === 'evaluation') {
                    // Evaluation ready - store turnId for display
                    if (parsed.turnId && currentSessionId) {
                      setSessionTurnId(currentSessionId, parsed.turnId);
                      // Capture for persistence
                      messageTurnId = parsed.turnId;
                      messageEffectiveMode = effectiveMode;
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
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m
          )
        );

        // Save assistant message to database with evaluation metadata
        await saveMessage(currentSessionId, "assistant", fullContent, {
          turnId: messageTurnId,
          effectiveMode: messageEffectiveMode,
        });
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
      // On error/abort, ensure streaming state is cleared in global store
      try {
        setSessionStreaming(currentSessionId, false);
      } catch (e) {
        console.warn('Failed to clear session streaming state:', e);
      }
    } finally {
      setIsLoading(false);
      setImageMode(false);
      // Unregister session from global store (non-critical)
      // This removes the session entirely after streaming is complete
      try {
        unregisterActiveSession(currentSessionId);
      } catch (e) {
        console.warn('Failed to unregister active session:', e);
      }
      // Navigate to session URL after streaming completes (if this was a new session)
      // This prevents remounting during streaming which would break the UI updates
      if (shouldNavigateAfterStreaming) {
        router.replace(`/chat/${currentSessionId}`);
      }
    }
  }, [sessionId, mode, webEnabled, attachments, effectiveMode, router]);

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
            {/* Trace minimize toggle */}
            <Button 
              variant={traceMinimized ? "outline" : "default"} 
              size="sm" 
              onClick={() => setTraceMinimized(!traceMinimized)}
              title={traceMinimized ? "Expand agent trace" : "Minimize agent trace"}
            >
              <Activity className="h-4 w-4" />
            </Button>

            {/* New chat link */}
            <Link 
              href="/chat" 
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-8 px-3 border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Link>
          </div>
        </header>

        {/* Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* Input Area */}
        <div className="border-t p-4 relative z-10">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Mode and Web Controls - above input */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Prompt Library - simple prompts */}
                <PromptPicker
                  onSelectPrompt={(content) => setInputValue(content)}
                  disabled={isLoading}
                />

                {/* Prompt Builder - parameterized templates */}
                <PromptBuilder
                  onInsertPrompt={(content) => setInputValue(content)}
                  disabled={isLoading}
                />

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

      {/* Reasoning/Trace Pane - Always visible */}
      <div className={`${traceMinimized ? 'w-16' : 'w-80'} flex-shrink-0 transition-all duration-200 overflow-hidden relative z-0`}>
        <ReasoningPane
          isVisible={true}
          isProcessing={isLoading}
          isMinimized={traceMinimized}
          onToggleMinimized={() => setTraceMinimized(!traceMinimized)}
          agentEvents={agentEvents}
          modeClassification={modeClassification}
        />
      </div>
    </div>
  );
}
