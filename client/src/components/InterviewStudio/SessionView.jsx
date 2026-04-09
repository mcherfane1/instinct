/**
 * SessionView — the main Interview Studio editor view.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  SessionHeader (name, date, timer, autosave, actions)    │
 *   ├──────────────┬───────────────────────────────────────────┤
 *   │ Context      │  Canvas (TipTap editor + toolbar)         │
 *   │ Panel        │                                           │
 *   │ (left rail)  │                                           │
 *   └──────────────┴───────────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import useSessionStore    from '../../store/sessionStore';
import useEngagementStore from '../../store/engagementStore';
import { sessionApi }     from '../../api/client';
import { PageSpinner }    from '../common/Spinner';
import SessionHeader      from './SessionHeader';
import SessionContextPanel from './SessionContextPanel';
import SessionCanvas      from './SessionCanvas';
import SessionCloseModal  from './SessionCloseModal';

const AUTOSAVE_DEBOUNCE_MS = 1500;

export default function SessionView({ engagementId, sessionId }) {
  const navigate = useNavigate();
  const { currentEngagement }                              = useEngagementStore();
  const { activeSession, autosave, restoreFromLocal, clearSession } = useSessionStore();

  const [isLoading, setIsLoading]         = useState(true);
  const [loadError, setLoadError]         = useState(null);
  const [restoredFromLocal, setRestored]  = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Autosave debounce ref
  const autosaveTimerRef = useRef(null);

  // Load session on mount
  useEffect(() => {
    let mounted = true;
    async function loadSession() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res     = await sessionApi.get(engagementId, sessionId);
        const server  = res.data;
        const wasLocal = await restoreFromLocal(sessionId, server);
        if (mounted) {
          setRestored(wasLocal);
          setElapsedSeconds(server.elapsed_seconds || 0);
        }
      } catch (err) {
        if (mounted) setLoadError(err.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadSession();
    return () => { mounted = false; };
  }, [sessionId, engagementId]);

  // Run timer when session is active
  useEffect(() => {
    if (!activeSession || activeSession.status === 'Closed') return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeSession?.session_id, activeSession?.status]);

  // Persist elapsed seconds every 30s to avoid drift on reload
  useEffect(() => {
    if (!activeSession || activeSession.status === 'Closed') return;
    const interval = setInterval(() => {
      autosave(engagementId, sessionId, { elapsed_seconds: elapsedSeconds });
    }, 30000);
    return () => clearInterval(interval);
  }, [elapsedSeconds, activeSession?.status]);

  /**
   * Called by SessionCanvas on every editor update (debounced here).
   */
  const handleCanvasChange = useCallback((canvasContent, canvasText) => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosave(engagementId, sessionId, { canvas_content: canvasContent, canvas_text: canvasText });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [engagementId, sessionId, autosave]);

  async function handleClose() {
    clearInterval(timerRef.current);
    await autosave(engagementId, sessionId, { elapsed_seconds: elapsedSeconds });
    setShowCloseModal(true);
  }

  async function handleCloseConfirmed() {
    setShowCloseModal(false);
    await clearSession(sessionId);
    navigate(`/engagements/${engagementId}/interview`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PageSpinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-600 font-medium">Failed to load session</p>
        <p className="text-sm text-gray-500">{loadError}</p>
        <button onClick={() => navigate(`/engagements/${engagementId}/interview`)}
          className="text-sm text-hbird-600 hover:underline">
          ← Back to sessions
        </button>
      </div>
    );
  }

  if (!activeSession) return null;

  const isClosed = activeSession.status === 'Closed';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Restored banner */}
      {restoredFromLocal && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 shrink-0">
          <span className="font-medium">Restored from local storage</span>
          <span className="text-amber-500">— unsaved changes were recovered after the last reload.</span>
          <button className="ml-auto text-amber-600 hover:underline" onClick={() => setRestored(false)}>Dismiss</button>
        </div>
      )}

      {/* Session header */}
      <SessionHeader
        session={activeSession}
        elapsedSeconds={elapsedSeconds}
        engagementId={engagementId}
        onClose={handleClose}
        onBack={() => navigate(`/engagements/${engagementId}/interview`)}
        isClosed={isClosed}
      />

      {/* Main layout: context panel + canvas */}
      <div className="flex flex-1 overflow-hidden">
        <SessionContextPanel
          engagementId={engagementId}
          session={activeSession}
          onSessionUpdate={delta => autosave(engagementId, sessionId, delta)}
        />
        <div className="flex-1 overflow-hidden flex flex-col">
          <SessionCanvas
            session={activeSession}
            onChange={handleCanvasChange}
            readOnly={isClosed}
            engagementId={engagementId}
          />
        </div>
      </div>

      {/* Close session modal */}
      {showCloseModal && (
        <SessionCloseModal
          engagementId={engagementId}
          session={activeSession}
          onDone={handleCloseConfirmed}
          onCancel={() => setShowCloseModal(false)}
        />
      )}
    </div>
  );
}
