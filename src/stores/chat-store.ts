import { create } from 'zustand';

interface ActiveSession {
  abortController: AbortController;
  startedAt: number;
}

interface ChatStore {
  // Active sessions state - tracks sessions with ongoing requests
  activeSessions: Map<string, ActiveSession>;
  
  // Actions
  registerActiveSession: (sessionId: string, abortController: AbortController) => void;
  unregisterActiveSession: (sessionId: string) => void;
  isSessionActive: (sessionId: string) => boolean;
  getActiveSessionIds: () => string[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessions: new Map(),

  registerActiveSession: (sessionId, abortController) => {
    set((state) => {
      const newMap = new Map(state.activeSessions);
      newMap.set(sessionId, { abortController, startedAt: Date.now() });
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

  isSessionActive: (sessionId) => get().activeSessions.has(sessionId),
  
  getActiveSessionIds: () => Array.from(get().activeSessions.keys()),
}));

// Convenience hook for components that just need active status for a single session
export const useIsSessionActive = (sessionId: string) => {
  return useChatStore((state) => state.activeSessions.has(sessionId));
};
