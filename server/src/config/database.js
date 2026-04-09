/**
 * SQLite database connection (Phase 1 local).
 * Phase 3: Replace the better-sqlite3 client with the Azure SQL Database
 * driver (@azure/mssql or tedious) — the rest of the codebase uses this
 * module exclusively, so the swap is config-only.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function getDatabase() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/instinct.db');

    // Ensure the data directory exists (important for first run)
    const dataDir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(path.resolve(dbPath));

    // Performance and correctness pragmas
    db.pragma('journal_mode = WAL');    // Better concurrent read performance
    db.pragma('foreign_keys = ON');     // Enforce FK constraints
    db.pragma('synchronous = NORMAL'); // Balance safety vs. write speed

    console.log(`[DB] Connected to SQLite at ${dbPath}`);
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Connection closed.');
  }
}

module.exports = { getDatabase, closeDatabase };
