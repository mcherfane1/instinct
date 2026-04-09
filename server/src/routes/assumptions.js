const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase } = require('../config/database');
const { logAudit }    = require('../middleware/auditLogger');
const { nextId }      = require('../utils/idGenerator');
const asyncHandler    = require('../utils/asyncHandler');
const vectorStore     = require('../services/vectorStore');

function parse(row) {
  if (!row) return null;
  return { ...row, linked_finding_ids: JSON.parse(row.linked_finding_ids || '[]') };
}

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { type, status } = req.query;
  let sql = 'SELECT * FROM assumptions_gaps WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (type)   { sql += ' AND type = ?';   params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY type, item_id';
  res.json(db.prepare(sql).all(...params).map(parse));
}));

router.get('/:itemId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM assumptions_gaps WHERE item_id = ? AND engagement_id = ?')
    .get(req.params.itemId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  res.json(parse(row));
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { type, workstream, statement, risk_if_wrong, resolution_plan, owner } = req.body;
  if (!type || !['Assumption', 'Gap'].includes(type)) {
    return res.status(400).json({ error: 'type must be Assumption or Gap' });
  }
  if (!statement?.trim()) return res.status(400).json({ error: 'statement is required' });

  const id  = nextId(type === 'Assumption' ? 'assumption' : 'gap');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assumptions_gaps
      (item_id, engagement_id, type, workstream, statement, risk_if_wrong,
       resolution_plan, owner, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.engagementId, type, workstream || null, statement.trim(),
    risk_if_wrong || null, resolution_plan || null, owner || null,
    req.user.userId, now, now);

  logAudit({ entityType: 'assumptions_gaps', entityId: id,
    newValue: { type, statement }, changedBy: req.user.userId, operationType: 'Create' });

  vectorStore.upsert(req.params.engagementId, {
    id, type: 'assumption_gap', text: statement,
    metadata: { item_type: type, workstream },
  });

  res.status(201).json(parse(db.prepare('SELECT * FROM assumptions_gaps WHERE item_id = ?').get(id)));
}));

router.put('/:itemId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const UPDATABLE = ['workstream', 'statement', 'risk_if_wrong', 'resolution_plan', 'owner',
                     'linked_finding_ids', 'status'];
  const updates = {};
  for (const f of UPDATABLE) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'linked_finding_ids' ? JSON.stringify(req.body[f]) : req.body[f];
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE assumptions_gaps SET ${setClauses} WHERE item_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.itemId, req.params.engagementId);
  logAudit({ entityType: 'assumptions_gaps', entityId: req.params.itemId,
    newValue: updates, changedBy: req.user.userId, operationType: 'Update' });
  res.json(parse(db.prepare('SELECT * FROM assumptions_gaps WHERE item_id = ?').get(req.params.itemId)));
}));

module.exports = router;
