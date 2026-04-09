const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase } = require('../config/database');
const { logAudit }    = require('../middleware/auditLogger');
const { nextId }      = require('../utils/idGenerator');
const asyncHandler    = require('../utils/asyncHandler');
const vectorStore     = require('../services/vectorStore');

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { status, relationship } = req.query;
  let sql = 'SELECT * FROM stakeholders WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (status)       { sql += ' AND status = ?';       params.push(status); }
  if (relationship) { sql += ' AND relationship = ?';  params.push(relationship); }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
}));

router.get('/:stakeholderId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM stakeholders WHERE stakeholder_id = ? AND engagement_id = ?')
    .get(req.params.stakeholderId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Stakeholder not found' });
  res.json(row);
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { name, role, organization, relationship, engagement_level, notes, last_interaction } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const id  = nextId('stakeholder');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO stakeholders
      (stakeholder_id, engagement_id, name, role, organization, relationship,
       engagement_level, notes, last_interaction, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.engagementId, name.trim(), role || null, organization || null,
    relationship || 'Unknown', engagement_level || 'Unknown', notes || null,
    last_interaction || null, req.user.userId, now, now);

  logAudit({ entityType: 'stakeholders', entityId: id,
    newValue: { name }, changedBy: req.user.userId, operationType: 'Create' });

  vectorStore.upsert(req.params.engagementId, {
    id, type: 'stakeholder', text: `${name} ${role || ''} ${organization || ''} ${notes || ''}`,
    metadata: { relationship },
  });

  res.status(201).json(db.prepare('SELECT * FROM stakeholders WHERE stakeholder_id = ?').get(id));
}));

router.put('/:stakeholderId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const UPDATABLE = ['name', 'role', 'organization', 'relationship', 'engagement_level',
                     'notes', 'last_interaction', 'status'];
  const updates = {};
  for (const f of UPDATABLE) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE stakeholders SET ${setClauses} WHERE stakeholder_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.stakeholderId, req.params.engagementId);
  logAudit({ entityType: 'stakeholders', entityId: req.params.stakeholderId,
    newValue: updates, changedBy: req.user.userId, operationType: 'Update' });
  res.json(db.prepare('SELECT * FROM stakeholders WHERE stakeholder_id = ?').get(req.params.stakeholderId));
}));

module.exports = router;
