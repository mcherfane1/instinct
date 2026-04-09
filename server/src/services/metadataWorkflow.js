/**
 * Metadata suggestion workflow (PRD §6).
 *
 * Handles the governed schema evolution process:
 *   1. AI identifies values outside the controlled vocabulary
 *   2. A Pending Approval suggestion record is created
 *   3. Engagement Lead approves or denies
 *   4. On approval: controlled list updated, affected records re-tagged
 *   5. On denial: AI re-conforms affected records to closest existing category
 *      • If reconfirm confidence >= 0.8: auto-commit
 *      • If reconfirm confidence <  0.8: surface for manual review
 *      • If AI cannot map: mark Unclassified
 */

const { getDatabase }        = require('../config/database');
const { logAudit }           = require('../middleware/auditLogger');
const { extractStructured }  = require('./aiProxy');
const { v4: uuidv4 }         = require('uuid');

const HIGH_CONFIDENCE = 0.8;

/**
 * Create a metadata suggestion record.
 * Called by the ingestion pipeline when a tag falls outside controlled vocab.
 */
function createSuggestion({
  engagementId,
  suggestionType,
  proposedValue,
  existingValue,
  scope,
  triggerSourceType,
  triggerSourceId,
  affectedRecordIds = [],
  aiConfidence,
  exampleText,
}) {
  const db = getDatabase();
  const id = `SGT-${uuidv4().slice(0, 8).toUpperCase()}`;

  db.prepare(`
    INSERT INTO metadata_suggestions
      (suggestion_id, engagement_id, suggestion_type, proposed_value, existing_value,
       scope, trigger_source_type, trigger_source_id, affected_record_ids,
       ai_confidence, example_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, engagementId, suggestionType, proposedValue, existingValue ?? null,
    scope, triggerSourceType ?? null, triggerSourceId ?? null,
    JSON.stringify(affectedRecordIds), aiConfidence ?? null, exampleText ?? null
  );

  console.log(`[MetadataWorkflow] Suggestion created: ${id} — ${suggestionType}: "${proposedValue}"`);
  return id;
}

/**
 * Engagement Lead approves a suggestion (PRD §6.2 — If Approved).
 * Updates the controlled vocabulary in Core Config and re-tags affected records.
 */
function approveSuggestion(suggestionId, reviewedBy) {
  const db = getDatabase();

  const suggestion = db.prepare(
    'SELECT * FROM metadata_suggestions WHERE suggestion_id = ?'
  ).get(suggestionId);

  if (!suggestion) throw Object.assign(new Error('Suggestion not found'), { status: 404 });
  if (suggestion.status !== 'Pending') {
    throw Object.assign(new Error('Suggestion has already been reviewed'), { status: 409 });
  }

  const config = db.prepare(
    'SELECT * FROM core_config WHERE engagement_id = ?'
  ).get(suggestion.engagement_id);

  const now = new Date().toISOString();

  db.transaction(() => {
    // 1. Mark suggestion approved
    db.prepare(`
      UPDATE metadata_suggestions
      SET status = 'Approved', reviewed_by = ?, reviewed_at = ?
      WHERE suggestion_id = ?
    `).run(reviewedBy, now, suggestionId);

    // 2. Add value to the relevant controlled list in Core Config
    const scopeField = scopeToField(suggestion.scope);
    if (scopeField && config) {
      const currentList = JSON.parse(config[scopeField] || '[]');
      if (!currentList.includes(suggestion.proposed_value)) {
        currentList.push(suggestion.proposed_value);
        db.prepare(
          `UPDATE core_config SET ${scopeField} = ?, updated_at = ? WHERE engagement_id = ?`
        ).run(JSON.stringify(currentList), now, suggestion.engagement_id);
      }

      // Handle renames: remove the old value
      if (suggestion.suggestion_type === 'Rename existing value' && suggestion.existing_value) {
        const renamed = currentList.filter(v => v !== suggestion.existing_value);
        db.prepare(
          `UPDATE core_config SET ${scopeField} = ?, updated_at = ? WHERE engagement_id = ?`
        ).run(JSON.stringify(renamed), now, suggestion.engagement_id);
      }
    }

    // 3. Re-tag affected records with the approved value
    const affected = JSON.parse(suggestion.affected_record_ids || '[]');
    retag(db, affected, suggestion.scope, suggestion.proposed_value, now);

    logAudit({
      entityType:    'metadata_suggestions',
      entityId:      suggestionId,
      newValue:      { status: 'Approved', proposedValue: suggestion.proposed_value },
      changedBy:     reviewedBy,
      operationType: 'Approve',
    });
  })();

  return { approved: true, suggestionId };
}

/**
 * Engagement Lead denies a suggestion (PRD §6.2 — If Denied).
 * Triggers deny-and-reconfirm: AI re-maps affected records.
 * Returns reconfirm results for records needing Engagement Lead review.
 */
async function denySuggestion(suggestionId, reviewedBy, engagementContext) {
  const db = getDatabase();

  const suggestion = db.prepare(
    'SELECT * FROM metadata_suggestions WHERE suggestion_id = ?'
  ).get(suggestionId);

  if (!suggestion) throw Object.assign(new Error('Suggestion not found'), { status: 404 });
  if (suggestion.status !== 'Pending') {
    throw Object.assign(new Error('Suggestion has already been reviewed'), { status: 409 });
  }

  const config = db.prepare(
    'SELECT * FROM core_config WHERE engagement_id = ?'
  ).get(suggestion.engagement_id);

  const controlledList = JSON.parse(config[scopeToField(suggestion.scope)] || '[]');
  const now = new Date().toISOString();

  // Mark denied
  db.prepare(`
    UPDATE metadata_suggestions
    SET status = 'Denied', reviewed_by = ?, reviewed_at = ?
    WHERE suggestion_id = ?
  `).run(reviewedBy, now, suggestionId);

  logAudit({
    entityType:    'metadata_suggestions',
    entityId:      suggestionId,
    newValue:      { status: 'Denied' },
    changedBy:     reviewedBy,
    operationType: 'Deny',
  });

  // Attempt AI reconfirm
  let reconfirmStatus = 'Unclassified';
  let reconfirmValue  = null;
  let reconfirmConf   = 0;

  try {
    const result = await reconfirmWithAI({
      deniedValue:    suggestion.proposed_value,
      controlledList,
      scope:          suggestion.scope,
      exampleText:    suggestion.example_text,
      engagementContext,
    });

    reconfirmValue = result.value;
    reconfirmConf  = result.confidence;

    if (result.confidence >= HIGH_CONFIDENCE) {
      // Auto-commit: re-tag records with the reconfirmed value
      const affected = JSON.parse(suggestion.affected_record_ids || '[]');
      retag(db, affected, suggestion.scope, result.value, now);
      reconfirmStatus = 'Auto-Committed';
    } else if (result.value) {
      reconfirmStatus = 'Pending-Lead-Review';
    } else {
      reconfirmStatus = 'Unclassified';
    }
  } catch (err) {
    if (err.status === 503) {
      console.warn('[MetadataWorkflow] AI unavailable during reconfirm — marking Unclassified');
    } else {
      console.error('[MetadataWorkflow] Reconfirm failed:', err.message);
    }
    reconfirmStatus = 'Unclassified';
  }

  // Persist reconfirm result
  db.prepare(`
    UPDATE metadata_suggestions
    SET reconfirm_value = ?, reconfirm_confidence = ?, reconfirm_status = ?
    WHERE suggestion_id = ?
  `).run(reconfirmValue, reconfirmConf, reconfirmStatus, suggestionId);

  return { denied: true, suggestionId, reconfirmStatus, reconfirmValue, reconfirmConf };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function reconfirmWithAI({ deniedValue, controlledList, scope, exampleText, engagementContext }) {
  if (controlledList.length === 0) return { value: null, confidence: 0 };

  const system = `You are a metadata classification assistant for a healthcare consulting engagement.
Your task: map a rejected metadata value to the CLOSEST existing category.
You MUST choose from the provided list ONLY. If no reasonable match exists, return null.
Return valid JSON only.`;

  const prompt = `
Denied value: "${deniedValue}"
Scope: ${scope}
Source context: "${exampleText || 'N/A'}"
Existing controlled vocabulary: ${JSON.stringify(controlledList)}
Engagement context: ${engagementContext || 'Healthcare consulting engagement'}

Return JSON: {"value": "<chosen_value_or_null>", "confidence": <0.0-1.0>, "reasoning": "<brief>"}
`.trim();

  const { text } = await extractStructured({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 256,
  });

  const parsed = JSON.parse(text);
  return {
    value:      controlledList.includes(parsed.value) ? parsed.value : null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

function retag(db, recordIds, scope, newValue, now) {
  // Records can be findings, notes, or artifacts depending on scope
  // For simplicity in Phase 1, update the workstream/contact_center/technology field
  // on findings and notes where the record ID matches
  const field = scopeToRecordField(scope);
  if (!field) return;

  for (const id of recordIds) {
    for (const table of ['findings', 'notes', 'artifacts']) {
      try {
        db.prepare(
          `UPDATE ${table} SET ${field} = ?, updated_at = ? WHERE rowid IN (SELECT rowid FROM ${table} WHERE finding_id = ? OR note_id = ? OR artifact_id = ?)`
        ).run(newValue, now, id, id, id);
      } catch {
        // Table may not have this field — ignore
      }
    }
  }
}

function scopeToField(scope) {
  const MAP = {
    'workstreams':    'workstreams',
    'technologies':   'technologies',
    'contact_centers':'contact_centers',
  };
  return MAP[scope] || null;
}

function scopeToRecordField(scope) {
  const MAP = {
    'workstreams':    'workstream',
    'technologies':   'technology',
    'contact_centers':'contact_center',
  };
  return MAP[scope] || null;
}

module.exports = { createSuggestion, approveSuggestion, denySuggestion };
