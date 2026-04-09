/**
 * Interview Studio session state store.
 * Manages the active session, canvas content, and sync status.
 */
import { create } from 'zustand';
import { sessionApi } from '../api/client';
import { saveSessionLocal, loadSessionLocal, clearSessionLocal } from '../db/sessionStore';

const useSessionStore = create((set, get) => ({
  activeSession:  null,
  sessions:       [],
  isSaving:       false,
  lastSavedAt:    null,
  syncError:      null,

  setActiveSession: (session) => set({ activeSession: session, lastSavedAt: null }),

  loadSessions: async (engagementId) => {
    try {
      const res = await sessionApi.list(engagementId);
      set({ sessions: res.data });
    } catch {}
  },

  /**
   * Autosave: write to IndexedDB immediately (never lose data),
   * then async sync to server.
   */
  autosave: async (engagementId, sessionId, delta) => {
    const current = get().activeSession;
    if (!current) return;

    const updated = { ...current, ...delta };
    set({ activeSession: updated });

    // 1. Write to IndexedDB immediately (synchronous-ish)
    await saveSessionLocal(updated);
    set({ lastSavedAt: new Date().toISOString() });

    // 2. Async server sync (non-blocking)
    try {
      await sessionApi.save(engagementId, sessionId, delta);
      set({ syncError: null });
    } catch (err) {
      set({ syncError: err.message });
      // IndexedDB copy is safe — data not lost
    }
  },

  /**
   * Restore a session from IndexedDB after a reload.
   * Returns true if local data was found and is newer than server data.
   */
  restoreFromLocal: async (sessionId, serverSession) => {
    const local = await loadSessionLocal(sessionId);
    if (!local) {
      set({ activeSession: serverSession });
      return false;
    }
    // Prefer local copy if it has canvas content and is newer
    const localNewer = local._saved_at > (serverSession?.updated_at ?? '');
    const restored   = localNewer ? { ...serverSession, ...local } : serverSession;
    set({ activeSession: restored });
    return localNewer;
  },

  clearSession: async (sessionId) => {
    await clearSessionLocal(sessionId);
    set({ activeSession: null, lastSavedAt: null, syncError: null });
  },
}));

export default useSessionStore;
