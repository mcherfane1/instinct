/**
 * Interview session routes (PRD §7.1).
 * Create, read, update, export.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true }); // inherits :engagementId
const { v4: uuidv4 } = require('uuid');

const { getDatabase }     = require('../config/database');
const { logAudit }        = require('../middleware/auditLogger');
const asyncHandler        = require('../utils/asyncHandler');

function parseSession(row) {
  if (!row) return null;
  return {
    ...row,
    participants: JSON.parse(row.participants || '[]'),
  };
}

// GET /engagements/:engagementId/sessions
router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM interview_sessions WHERE engagement_id = ? ORDER BY created_at DESC'
  ).all(req.params.engagementId);
  res.json(rows.map(parseSession));
}));

// GET /engagements/:engagementId/sessions/:sessionId
router.get('/:sessionId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM interview_sessions WHERE session_id = ? AND engagement_id = ?'
  ).get(req.params.sessionId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Session not found' });
  res.json(parseSession(row));
}));

// POST /engagements/:engagementId/sessions — Create session
router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, date, participants, workstream, contact_center } = req.body;

  if (!name?.trim() || !date) {
    return res.status(400).json({ error: 'name and date are required' });
  }

  const session_id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO interview_sessions
      (session_id, engagement_id, name, date, participants, workstream,
       contact_center, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session_id, req.params.engagementId, name.trim(), date,
    JSON.stringify(participants || []),
    workstream || null, contact_center || null,
    req.user.userId, now, now
  );

  logAudit({
    entityType: 'interview_sessions', entityId: session_id,
    newValue: { name, date, engagementId: req.params.engagementId },
    changedBy: req.user.userId, operationType: 'Create',
  });

  res.status(201).json(parseSession(
    db.prepare('SELECT * FROM interview_sessions WHERE session_id = ?').get(session_id)
  ));
}));

// PUT /engagements/:engagementId/sessions/:sessionId — Autosave canvas + metadata
router.put('/:sessionId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { sessionId, engagementId } = req.params;

  const existing = db.prepare(
    'SELECT * FROM interview_sessions WHERE session_id = ? AND engagement_id = ?'
  ).get(sessionId, engagementId);
  if (!existing) return res.status(404).json({ error: 'Session not found' });

  const UPDATABLE = [
    'name', 'date', 'participants', 'workstream', 'contact_center',
    'canvas_content', 'canvas_text', 'elapsed_seconds', 'status',
  ];

  const updates = {};
  for (const field of UPDATABLE) {
    if (req.body[field] !== undefined) {
      updates[field] = field === 'participants'
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
    `UPDATE interview_sessions SET ${setClauses} WHERE session_id = ?`
  ).run(...Object.values(updates), sessionId);

  res.json({ ok: true, sessionId, updated_at: updates.updated_at });
}));

// POST /engagements/:engagementId/sessions/:sessionId/close — Close and run AI review
router.post('/:sessionId/close', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const session = db.prepare(
    'SELECT * FROM interview_sessions WHERE session_id = ? AND engagement_id = ?'
  ).get(req.params.sessionId, req.params.engagementId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // AI metadata review is handled by /ai/session-review — this just closes the session
  db.prepare(
    "UPDATE interview_sessions SET status = 'Closed', updated_at = ? WHERE session_id = ?"
  ).run(new Date().toISOString(), req.params.sessionId);

  logAudit({
    entityType: 'interview_sessions', entityId: req.params.sessionId,
    newValue: { status: 'Closed' },
    changedBy: req.user.userId, operationType: 'Update',
  });

  res.json({ ok: true, status: 'Closed' });
}));

module.exports = router;
