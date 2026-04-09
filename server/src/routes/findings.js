/**
 * Findings routes — Entity 3 (PRD §5.3).
 * Includes the promote-from-note endpoint.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });

const { getDatabase }           = require('../config/database');
const { requireEngagementLead } = require('../middleware/rbac');
const { logAudit }              = require('../middleware/auditLogger');
const { nextId }                = require('../utils/idGenerator');
const asyncHandler              = require('../utils/asyncHandler');
const vectorStore               = require('../services/vectorStore');

const MULTI_VALUE = new Set(['contact_center', 'technology', 'linked_question_ids']);

function parseFinding(row) {
  if (!row) return null;
  const r = { ...row };
  for (const f of MULTI_VALUE) {
    try { r[f] = JSON.parse(row[f] || '[]'); } catch { r[f] = []; }
  }
  return r;
}

// GET /engagements/:engagementId/findings
router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { workstream, state_tag, review_status, confidence } = req.query;

  let sql = 'SELECT * FROM findings WHERE engagement_id = ?';
  const params = [req.params.engagementId];

  if (workstream)     { sql += ' AND workstream = ?';     params.push(workstream); }
  if (state_tag)      { sql += ' AND state_tag = ?';      params.push(state_tag); }
  if (review_status)  { sql += ' AND review_status = ?';  params.push(review_status); }
  if (confidence)     { sql += ' AND confidence = ?';     params.push(confidence); }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(parseFinding));
}));

// GET /engagements/:engagementId/findings/:findingId
router.get('/:findingId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM findings WHERE finding_id = ? AND engagement_id = ?'
  ).get(req.params.findingId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Finding not found' });
  res.json(parseFinding(row));
}));

// POST /engagements/:engagementId/findings — Create finding directly
router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { finding_text, state_tag, workstream, contact_center, technology,
          source_type, source_artifact_id, source_note_id,
          provided_by, linked_question_ids, confidence } = req.body;

  if (!finding_text?.trim()) {
    return res.status(400).json({ error: 'finding_text is required' });
  }

  const finding_id = nextId('finding');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO findings
      (finding_id, engagement_id, finding_text, state_tag, workstream,
       contact_center, technology, source_type, source_artifact_id, source_note_id,
       provided_by, linked_question_ids, confidence, review_status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Needs Review', ?, ?, ?)
  `).run(
    finding_id, req.params.engagementId, finding_text.trim(),
    state_tag || null, workstream || null,
    JSON.stringify(contact_center || []),
    JSON.stringify(technology || []),
    source_type || null, source_artifact_id || null, source_note_id || null,
    provided_by || null, JSON.stringify(linked_question_ids || []),
    confidence || 'Unverified',
    req.user.userId, now, now
  );

  logAudit({
    entityType: 'findings', entityId: finding_id,
    newValue: { finding_text }, changedBy: req.user.userId, operationType: 'Create',
  });

  vectorStore.upsert(req.params.engagementId, {
    id: finding_id, type: 'finding',
    text: finding_text,
    metadata: { state_tag, workstream },
  });

  res.status(201).json(parseFinding(
    db.prepare('SELECT * FROM findings WHERE finding_id = ?').get(finding_id)
  ));
}));

// PUT /:findingId — Update finding
router.put('/:findingId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const existing = db.prepare(
    'SELECT * FROM findings WHERE finding_id = ? AND engagement_id = ?'
  ).get(req.params.findingId, req.params.engagementId);
  if (!existing) return res.status(404).json({ error: 'Finding not found' });

  const UPDATABLE = [
    'finding_text', 'state_tag', 'workstream', 'contact_center', 'technology',
    'source_type', 'provided_by', 'linked_question_ids', 'confidence', 'review_status',
  ];

  const updates = {};
  for (const field of UPDATABLE) {
    if (req.body[field] !== undefined) {
      updates[field] = MULTI_VALUE.has(field)
        ? JSON.stringify(req.body[field])
        : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields' });
  }

  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(
    `UPDATE findings SET ${setClauses} WHERE finding_id = ?`
  ).run(...Object.values(updates), req.params.findingId);

  logAudit({
    entityType: 'findings', entityId: req.params.findingId,
    oldValue: parseFinding(existing), newValue: updates,
    changedBy: req.user.userId, operationType: 'Update',
  });

  if (updates.finding_text) {
    vectorStore.upsert(req.params.engagementId, {
      id: req.params.findingId, type: 'finding',
      text: updates.finding_text,
      metadata: { state_tag: updates.state_tag, workstream: updates.workstream },
    });
  }

  res.json(parseFinding(
    db.prepare('SELECT * FROM findings WHERE finding_id = ?').get(req.params.findingId)
  ));
}));

// POST /:findingId/confirm — Engagement Lead confirms a finding (PRD §5.3)
router.post('/:findingId/confirm', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE findings SET review_status = 'Confirmed', confidence = CASE WHEN confidence = 'Unverified' THEN 'Medium' ELSE confidence END, updated_at = ? WHERE finding_id = ? AND engagement_id = ?"
  ).run(now, req.params.findingId, req.params.engagementId);
  logAudit({
    entityType: 'findings', entityId: req.params.findingId,
    newValue: { review_status: 'Confirmed' }, changedBy: req.user.userId, operationType: 'Update',
  });
  res.json({ ok: true });
}));

// POST /promote-note — Promote a Note to a Finding (PRD §7.1.7)
router.post('/promote-note', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const {
    note_id, finding_text, state_tag, workstream, contact_center,
    technology, confidence, provided_by,
  } = req.body;

  if (!note_id || !finding_text?.trim()) {
    return res.status(400).json({ error: 'note_id and finding_text are required' });
  }

  const note = db.prepare(
    'SELECT * FROM notes WHERE note_id = ? AND engagement_id = ?'
  ).get(note_id, req.params.engagementId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const finding_id = nextId('finding');
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO findings
        (finding_id, engagement_id, finding_text, state_tag, workstream,
         contact_center, technology, source_type, source_note_id,
         provided_by, confidence, review_status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Interview', ?, ?, ?, 'Confirmed', ?, ?, ?)
    `).run(
      finding_id, req.params.engagementId, finding_text.trim(),
      state_tag || null, workstream || note.workstream,
      JSON.stringify(contact_center || []),
      JSON.stringify(technology || []),
      note_id, provided_by || note.speaker,
      confidence || 'Medium',
      req.user.userId, now, now
    );

    db.prepare(
      "UPDATE notes SET review_status = 'Promoted', promoted_to_finding_id = ?, updated_at = ? WHERE note_id = ?"
    ).run(finding_id, now, note_id);
  })();

  logAudit({
    entityType: 'notes', entityId: note_id,
    newValue: { promoted_to_finding_id: finding_id },
    changedBy: req.user.userId, operationType: 'Promote',
  });
  logAudit({
    entityType: 'findings', entityId: finding_id,
    newValue: { finding_text, source_note_id: note_id },
    changedBy: req.user.userId, operationType: 'Create',
  });

  vectorStore.upsert(req.params.engagementId, {
    id: finding_id, type: 'finding',
    text: finding_text,
    metadata: { state_tag, workstream },
  });

  res.status(201).json(parseFinding(
    db.prepare('SELECT * FROM findings WHERE finding_id = ?').get(finding_id)
  ));
}));

module.exports = router;
