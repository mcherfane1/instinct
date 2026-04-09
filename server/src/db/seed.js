/**
 * Seed script — development only.
 * Per PRD §8 (V1 Deployment Note): "Hummingbird Instinct V1 ships clean with
 * no pre-loaded engagement data."
 *
 * This script is intentionally minimal. Run it to verify the database
 * is accepting writes; it creates a single test engagement and removes it.
 *
 * Usage: npm run seed --workspace=server
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { getDatabase, closeDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function seed() {
  console.log('[Seed] Running DB write verification...');
  const db = getDatabase();

  const testId = uuidv4();
  const ts = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO core_config (engagement_id, client_name, engagement_name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(testId, 'SEED TEST CLIENT', 'SEED TEST ENGAGEMENT', 'seed-script', ts, ts);

    const row = db.prepare('SELECT engagement_id, client_name FROM core_config WHERE engagement_id = ?').get(testId);
    console.log('[Seed] Write verified:', row);

    db.prepare('DELETE FROM core_config WHERE engagement_id = ?').run(testId);
    console.log('[Seed] Cleanup complete. Database is healthy.');
  } catch (err) {
    console.error('[Seed] Seed failed:', err.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

seed();
