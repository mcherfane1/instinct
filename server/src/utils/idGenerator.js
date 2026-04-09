/**
 * Generates sequential, human-readable IDs in the format PREFIX-NNN.
 * Uses an atomic SQLite transaction to prevent gaps or duplicates under
 * concurrent writes.
 *
 * Examples: FND-001, STK-042, Q-007, ART-123
 */

const { getDatabase } = require('../config/database');

const PREFIX_MAP = {
  finding:     'FND',
  question:    'Q',
  stakeholder: 'STK',
  artifact:    'ART',
  assumption:  'ASM',
  gap:         'GAP',
  action:      'ACT',
  decision:    'DEC',
  suggestion:  'SGT',
  session:     'SES',
};

function nextId(entityType) {
  const db = getDatabase();
  const prefix = PREFIX_MAP[entityType];
  if (!prefix) {
    throw new Error(`[IdGenerator] Unknown entity type: "${entityType}"`);
  }

  // Atomic increment — safe under concurrent requests (WAL mode + serialized writes)
  const increment = db.transaction(() => {
    db.prepare(
      'UPDATE id_counters SET current_value = current_value + 1 WHERE entity_type = ?'
    ).run(entityType);
    const row = db.prepare(
      'SELECT current_value FROM id_counters WHERE entity_type = ?'
    ).get(entityType);
    return row.current_value;
  });

  const value = increment();
  return `${prefix}-${String(value).padStart(3, '0')}`;
}

module.exports = { nextId };
