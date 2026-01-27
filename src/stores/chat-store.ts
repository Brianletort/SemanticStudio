import { create } from 'zustand';

interface ActiveSession {
  abortController: AbortController;
  startedAt: number;
  isStreaming: boolean; // True while actively receiving chunks, false when done
}

interface ChatStore {
  // Active sessions state - tracks sessions with ongoing requests
  activeSessions: Map<string, ActiveSession>;
  
  // Actions
  registerActiveSession: (sessionId: string, abortController: AbortController) => void;
  unregisterActiveSession: (sessionId: string) => void;
  setSessionStreaming: (sessionId: string, isStreaming: boolean) => void;
  isSessionActive: (sessionId: string) => boolean;
  isSessionStreaming: (sessionId: string) => boolean;
  getActiveSessionIds: () => string[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessions: new Map(),

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
