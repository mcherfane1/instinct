/**
 * Migration runner — executes schema.sql against the local SQLite database.
 * Phase 3: Replace with Azure SQL migration tooling (e.g. Flyway or EF migrations).
 *
 * Usage: npm run migrate --workspace=server
 *        node src/db/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');
const { getDatabase, closeDatabase } = require('../config/database');

function migrate() {
  console.log('[Migrate] Starting schema migration...');

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('[Migrate] schema.sql not found at:', schemaPath);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const db = getDatabase();

  try {
    // Split on semicolons and run each statement individually
    // (better-sqlite3 exec() handles multi-statement SQL directly)
    db.exec(schema);
    console.log('[Migrate] Schema applied successfully.');
    console.log('[Migrate] Database ready at:', process.env.DB_PATH || './data/instinct.db');
  } catch (err) {
    console.error('[Migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

migrate();
