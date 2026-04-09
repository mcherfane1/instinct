const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase } = require('../config/database');
const { logAudit }    = require('../middleware/auditLogger');
const { nextId }      = require('../utils/idGenerator');
const asyncHandler    = require('../utils/asyncHandler');
const vectorStore     = require('../services/vectorStore');

function parseQ(row) {
  if (!row) return null;
  return { ...row, linked_finding_ids: JSON.parse(row.linked_finding_ids || '[]') };
}

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { status, section } = req.query;
  let sql = 'SELECT * FROM questions WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (status)  { sql += ' AND status = ?';  params.push(status); }
  if (section) { sql += ' AND section = ?'; params.push(section); }
  sql += ' ORDER BY section, question_id';
  res.json(db.prepare(sql).all(...params).map(parseQ));
}));

router.get('/:questionId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM questions WHERE question_id = ? AND engagement_id = ?')
    .get(req.params.questionId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  res.json(parseQ(row));
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { section, question_text } = req.body;
  if (!question_text?.trim()) return res.status(400).json({ error: 'question_text is required' });

  const question_id = nextId('question');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO questions (question_id, engagement_id, section, question_text, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(question_id, req.params.engagementId, section || null, question_text.trim(), req.user.userId, now, now);

  logAudit({ entityType: 'questions', entityId: question_id,
    newValue: { question_text }, changedBy: req.user.userId, operationType: 'Create' });

  vectorStore.upsert(req.params.engagementId, {
    id: question_id, type: 'question', text: question_text,
    metadata: { section, status: 'Open' },
  });

  res.status(201).json(parseQ(db.prepare('SELECT * FROM questions WHERE question_id = ?').get(question_id)));
}));

router.put('/:questionId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const UPDATABLE = ['section', 'question_text', 'answer_text', 'provided_by',
                     'source_artifact_id', 'date_answered', 'linked_finding_ids', 'status'];
  const updates = {};
  for (const f of UPDATABLE) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'linked_finding_ids' ? JSON.stringify(req.body[f]) : req.body[f];
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE questions SET ${setClauses} WHERE question_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.questionId, req.params.engagementId);

  logAudit({ entityType: 'questions', entityId: req.params.questionId,
    newValue: updates, changedBy: req.user.userId, operationType: 'Update' });

  res.json(parseQ(db.prepare('SELECT * FROM questions WHERE question_id = ?').get(req.params.questionId)));
}));

// Bulk insert (used by Setup Step 6 questionnaire seeding)
router.post('/bulk', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array is required' });
  }

  const now = new Date().toISOString();
  const created = [];

  const insert = db.prepare(`
    INSERT INTO questions (question_id, engagement_id, section, question_text, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const q of questions) {
      if (!q.question_text?.trim()) continue;
      const id = nextId('question');
      insert.run(id, req.params.engagementId, q.section || null, q.question_text.trim(), req.user.userId, now, now);
      created.push(id);
    }
  });
  insertMany();

  res.status(201).json({ created: created.length, question_ids: created });
}));

module.exports = router;
