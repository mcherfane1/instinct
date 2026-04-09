const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase }           = require('../config/database');
const { requireEngagementLead } = require('../middleware/rbac');
const { logAudit }              = require('../middleware/auditLogger');
const { nextId }                = require('../utils/idGenerator');
const asyncHandler              = require('../utils/asyncHandler');

function parse(row) {
  if (!row) return null;
  return { ...row, linked_ids: JSON.parse(row.linked_ids || '[]') };
}

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { type, status, owner } = req.query;
  let sql = 'SELECT * FROM decisions_actions WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (type)   { sql += ' AND type = ?';   params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (owner)  { sql += ' AND owner = ?';  params.push(owner); }
  sql += ' ORDER BY type, created_at DESC';
  res.json(db.prepare(sql).all(...params).map(parse));
}));

router.get('/:itemId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM decisions_actions WHERE item_id = ? AND engagement_id = ?')
    .get(req.params.itemId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  res.json(parse(row));
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { type, workstream, description, owner, due_date, linked_ids } = req.body;
  if (!type || !['Decision', 'Action'].includes(type)) {
    return res.status(400).json({ error: 'type must be Decision or Action' });
  }
  if (!description?.trim()) return res.status(400).json({ error: 'description is required' });

  const id  = nextId(type === 'Decision' ? 'decision' : 'action');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO decisions_actions
      (item_id, engagement_id, type, workstream, description, owner, due_date,
       linked_ids, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.engagementId, type, workstream || null, description.trim(),
    owner || null, due_date || null, JSON.stringify(linked_ids || []),
    req.user.userId, now, now);

  logAudit({ entityType: 'decisions_actions', entityId: id,
    newValue: { type, description }, changedBy: req.user.userId, operationType: 'Create' });

  res.status(201).json(parse(db.prepare('SELECT * FROM decisions_actions WHERE item_id = ?').get(id)));
}));

router.put('/:itemId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM decisions_actions WHERE item_id = ? AND engagement_id = ?')
    .get(req.params.itemId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Item not found' });

  // Confirmed decisions are immutable (PRD §7.4) — only supersedable
  if (row.type === 'Decision' && row.confirmed_date && !req.body.is_superseded) {
    return res.status(409).json({ error: 'Confirmed decisions are immutable. Use supersede instead.' });
  }

  const UPDATABLE = ['workstream', 'description', 'owner', 'due_date', 'linked_ids', 'status',
                     'confirmed_date', 'is_superseded', 'superseded_by'];
  const updates = {};
  for (const f of UPDATABLE) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'linked_ids' ? JSON.stringify(req.body[f]) : req.body[f];
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE decisions_actions SET ${setClauses} WHERE item_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.itemId, req.params.engagementId);
  logAudit({ entityType: 'decisions_actions', entityId: req.params.itemId,
    newValue: updates, changedBy: req.user.userId, operationType: 'Update' });
  res.json(parse(db.prepare('SELECT * FROM decisions_actions WHERE item_id = ?').get(req.params.itemId)));
}));

// POST /:itemId/confirm — Confirm a decision (Engagement Lead only)
router.post('/:itemId/confirm', requireEngagementLead, asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const now = new Date().toISOString();
  const row = db.prepare('SELECT * FROM decisions_actions WHERE item_id = ? AND engagement_id = ?')
    .get(req.params.itemId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  if (row.type !== 'Decision') return res.status(400).json({ error: 'Only decisions can be confirmed' });

  db.prepare("UPDATE decisions_actions SET confirmed_date = ?, status = 'Complete', updated_at = ? WHERE item_id = ?")
    .run(now, now, req.params.itemId);
  logAudit({ entityType: 'decisions_actions', entityId: req.params.itemId,
    newValue: { confirmed_date: now }, changedBy: req.user.userId, operationType: 'Update' });
  res.json({ ok: true, confirmed_date: now });
}));

module.exports = router;
