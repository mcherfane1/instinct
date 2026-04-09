/**
 * IndexedDB session store (PRD §7.1.3, §12.2).
 *
 * "No in-flight notes may be lost on browser refresh, network interruption,
 *  or unexpected close. Session state persisted to local storage continuously."
 *
 * Uses the `idb` library (Promise-based IndexedDB wrapper).
 * All Interview Studio writes go here first, then sync to the server.
 * On reload, the client reads from IndexedDB and restores exactly.
 */

import { openDB } from 'idb';

const DB_NAME    = 'hbird-instinct';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let _db;

async function getDB() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'session_id' });
        }
      },
    });
  }
  return _db;
}

/**
 * Persist full session state to IndexedDB.
 * Called on every canvas keystroke (debounced in the component).
 *
 * @param {object} sessionState — full session object including canvas_content
 */
export async function saveSessionLocal(sessionState) {
  const db = await getDB();
  await db.put(STORE_NAME, {
    ...sessionState,
    _saved_at: new Date().toISOString(),
  });
}

/**
 * Load a session from IndexedDB.
 * Returns null if not found (first load from server).
 */
export async function loadSessionLocal(sessionId) {
  const db = await getDB();
  return db.get(STORE_NAME, sessionId);
}

/**
 * List all locally-stored sessions (for recovery UI).
 */
export async function listLocalSessions() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/**
 * Remove a session from IndexedDB after it has been successfully exported/closed.
 */
export async function clearSessionLocal(sessionId) {
  const db = await getDB();
  await db.delete(STORE_NAME, sessionId);
}

/**
 * Check if there are locally-stored sessions that haven't been synced.
 * Used on app startup to show a recovery banner.
 */
export async function getUnsyncedSessions() {
  const all = await listLocalSessions();
  return all.filter(s => s.status === 'Active' && s._saved_at);
}
