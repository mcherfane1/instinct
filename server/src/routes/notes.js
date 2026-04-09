const express = require('express');
const router  = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const { logAudit }    = require('../middleware/auditLogger');
const asyncHandler    = require('../utils/asyncHandler');

function parseNote(row) {
  if (!row) return null;
  return { ...row, linked_question_ids: JSON.parse(row.linked_question_ids || '[]') };
}

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { session_id, review_status } = req.query;
  let sql = 'SELECT * FROM notes WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (session_id)    { sql += ' AND session_id = ?';    params.push(session_id); }
  if (review_status) { sql += ' AND review_status = ?'; params.push(review_status); }
  sql += ' ORDER BY created_at ASC';
  res.json(db.prepare(sql).all(...params).map(parseNote));
}));

router.get('/:noteId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM notes WHERE note_id = ? AND engagement_id = ?')
    .get(req.params.noteId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Note not found' });
  res.json(parseNote(row));
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { session_id, text, note_type, workstream, contact_center, technology,
          speaker, timestamp_in_session, linked_question_ids } = req.body;

  if (!session_id || !text?.trim()) {
    return res.status(400).json({ error: 'session_id and text are required' });
  }

  const note_id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notes
      (note_id, session_id, engagement_id, text, note_type, workstream,
       contact_center, technology, speaker, timestamp_in_session,
       linked_question_ids, captured_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    note_id, session_id, req.params.engagementId, text.trim(),
    note_type || null, workstream || null, contact_center || null,
    technology || null, speaker || null, timestamp_in_session || null,
    JSON.stringify(linked_question_ids || []),
    req.user.userId, now, now
  );

  logAudit({
    entityType: 'notes', entityId: note_id,
    newValue: { session_id, text: text.slice(0, 100) },
    changedBy: req.user.userId, operationType: 'Create',
  });

  res.status(201).json(parseNote(db.prepare('SELECT * FROM notes WHERE note_id = ?').get(note_id)));
}));

router.put('/:noteId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const UPDATABLE = ['text', 'note_type', 'workstream', 'contact_center', 'technology',
                     'speaker', 'linked_question_ids', 'review_status'];
  const updates = {};
  for (const field of UPDATABLE) {
    if (req.body[field] !== undefined) {
      updates[field] = field === 'linked_question_ids'
        ? JSON.stringify(req.body[field])
        : req.body[field];
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE notes SET ${setClauses} WHERE note_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.noteId, req.params.engagementId);
  res.json({ ok: true });
}));

module.exports = router;
