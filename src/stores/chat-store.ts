import { create } from 'zustand';
import type { AgentEvent, ModeClassification } from '@/lib/chat/types';

interface ActiveSession {
  abortController: AbortController;
  startedAt: number;
  isStreaming: boolean; // True while actively receiving chunks, false when done
}

// Chat mode type - matches the frontend component
export type ChatMode = 'auto' | 'quick' | 'think' | 'deep' | 'research';

// Per-session trace state that persists across navigation
interface SessionTraceState {
  agentEvents: AgentEvent[];
  modeClassification: ModeClassification | null;
  currentTurnId: string | null;
}

interface ChatStore {
  // Active sessions state - tracks sessions with ongoing requests
  activeSessions: Map<string, ActiveSession>;
  
  // Session preferences - persist across messages within browser session
  webEnabled: boolean;
  mode: ChatMode;
  
  // Track the session that was just created locally (to preserve trace state on navigation)
  justCreatedSessionId: string | null;
  
  // Per-session trace state - keyed by sessionId
  sessionTraceState: Map<string, SessionTraceState>;
  
  // Actions
  registerActiveSession: (sessionId: string, abortController: AbortController) => void;
  unregisterActiveSession: (sessionId: string) => void;
  setSessionStreaming: (sessionId: string, isStreaming: boolean) => void;
  isSessionActive: (sessionId: string) => boolean;
  isSessionStreaming: (sessionId: string) => boolean;
  getActiveSessionIds: () => string[];
  setWebEnabled: (enabled: boolean) => void;
  setMode: (mode: ChatMode) => void;
  setJustCreatedSessionId: (sessionId: string | null) => void;
  
  // Trace state actions
  getSessionTraceState: (sessionId: string) => SessionTraceState | undefined;
  setSessionAgentEvents: (sessionId: string, events: AgentEvent[]) => void;
  addSessionAgentEvent: (sessionId: string, event: AgentEvent) => void;
  setSessionModeClassification: (sessionId: string, classification: ModeClassification | null) => void;
  setSessionTurnId: (sessionId: string, turnId: string | null) => void;
  clearSessionTraceState: (sessionId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessions: new Map(),
  
  // Session preferences - default values
  webEnabled: false,
  mode: 'auto' as ChatMode,
  
  // Track the session that was just created locally (to preserve trace state on navigation)
  justCreatedSessionId: null,
  
  // Per-session trace state
  sessionTraceState: new Map(),

  registerActiveSession: (sessionId, abortController) => {
    set((state) => {
      const newMap = new Map(state.activeSessions);
      newMap.set(sessionId, { abortController, startedAt: Date.now(), isStreaming: true });
      return { activeSessions: newMap };
    });
  },

  unregisterActiveSession: (sessionId) => {
    set((state) => {
      const newMap = new Map(state.activeSessions);
      newMap.delete(sessionId);
      return { activeSessions: newMap };
    });
  },

  setSessionStreaming: (sessionId, isStreaming) => {
    set((state) => {
      const session = state.activeSessions.get(sessionId);
      if (!session) return state;
      const newMap = new Map(state.activeSessions);
      newMap.set(sessionId, { ...session, isStreaming });
      return { activeSessions: newMap };
    });
  },

  isSessionActive: (sessionId) => get().activeSessions.has(sessionId),
  
  isSessionStreaming: (sessionId) => {
    const session = get().activeSessions.get(sessionId);
    return session?.isStreaming ?? false;
  },
  
  getActiveSessionIds: () => Array.from(get().activeSessions.keys()),
  
  setWebEnabled: (enabled) => set({ webEnabled: enabled }),
  
  setMode: (mode) => set({ mode }),
  
  setJustCreatedSessionId: (sessionId) => set({ justCreatedSessionId: sessionId }),
  
  // Trace state actions
  getSessionTraceState: (sessionId) => get().sessionTraceState.get(sessionId),
  
  setSessionAgentEvents: (sessionId, events) => {
    set((state) => {
      const newMap = new Map(state.sessionTraceState);
      const existing = newMap.get(sessionId) || { agentEvents: [], modeClassification: null, currentTurnId: null };
      newMap.set(sessionId, { ...existing, agentEvents: events });
      return { sessionTraceState: newMap };
    });
  },
  
  addSessionAgentEvent: (sessionId, event) => {
    set((state) => {
      const newMap = new Map(state.sessionTraceState);
      const existing = newMap.get(sessionId) || { agentEvents: [], modeClassification: null, currentTurnId: null };
      newMap.set(sessionId, { ...existing, agentEvents: [...existing.agentEvents, event] });
      return { sessionTraceState: newMap };
    });
  },
  
  setSessionModeClassification: (sessionId, classification) => {
    set((state) => {
      const newMap = new Map(state.sessionTraceState);
      const existing = newMap.get(sessionId) || { agentEvents: [], modeClassification: null, currentTurnId: null };
      newMap.set(sessionId, { ...existing, modeClassification: classification });
      return { sessionTraceState: newMap };
    });
  },
  
  setSessionTurnId: (sessionId, turnId) => {
    set((state) => {
      const newMap = new Map(state.sessionTraceState);
      const existing = newMap.get(sessionId) || { agentEvents: [], modeClassification: null, currentTurnId: null };
      newMap.set(sessionId, { ...existing, currentTurnId: turnId });
      return { sessionTraceState: newMap };
    });
  },
  
  clearSessionTraceState: (sessionId) => {
    set((state) => {
      const newMap = new Map(state.sessionTraceState);
      newMap.set(sessionId, { agentEvents: [], modeClassification: null, currentTurnId: null });
      return { sessionTraceState: newMap };
    });
  },
}));

// Convenience hook for components that just need active status for a single session
// This returns true if the session is actively streaming (shows spinner)
export const useIsSessionActive = (sessionId: string) => {
  return useChatStore((state) => {
    const session = state.activeSessions.get(sessionId);
    // Show spinner if session exists AND is still streaming
    return session?.isStreaming ?? false;
  });
};

// Hook for components that need to know if a session is streaming
export const useIsSessionStreaming = (sessionId: string) => {
  return useChatStore((state) => {
    const session = state.activeSessions.get(sessionId);
    return session?.isStreaming ?? false;
  });
};
