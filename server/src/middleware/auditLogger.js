/**
 * Audit log writer (PRD §12.3).
 *
 * The audit_log table is APPEND-ONLY. This function is the single write
 * path — call it from any route handler that mutates knowledge model data.
 *
 * Failures are logged to stderr but never propagate to the caller —
 * an audit log failure must not break a user-facing operation.
 */

const { getDatabase } = require('../config/database');

/**
 * @param {object} params
 * @param {string} params.entityType   — 'core_config' | 'findings' | 'notes' | etc.
 * @param {string} params.entityId     — The primary key of the affected record
 * @param {string} [params.fieldName]  — Specific field changed (optional)
 * @param {*}      [params.oldValue]   — Previous value (will be JSON.stringified)
 * @param {*}      [params.newValue]   — New value (will be JSON.stringified)
 * @param {string} params.changedBy    — req.user.userId
 * @param {string} params.operationType — Create | Update | Delete | Promote | Approve | Deny
 */
function logAudit({ entityType, entityId, fieldName, oldValue, newValue, changedBy, operationType }) {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO audit_log
        (entity_type, entity_id, field_name, old_value, new_value, changed_by, operation_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType,
      entityId,
      fieldName   ?? null,
      oldValue    !== undefined ? JSON.stringify(oldValue)  : null,
      newValue    !== undefined ? JSON.stringify(newValue)  : null,
      changedBy,
      operationType
    );
  } catch (err) {
    console.error('[AuditLog] Failed to write entry:', err.message, { entityType, entityId });
  }
}

module.exports = { logAudit };
