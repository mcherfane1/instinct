/**
 * Engagement routes — Core Config CRUD (PRD §5.1, §8).
 * Covers: list, get, create (setup Step 1), update.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { getDatabase }         = require('../config/database');
const { requireEngagementLead } = require('../middleware/rbac');
const { logAudit }            = require('../middleware/auditLogger');
const asyncHandler            = require('../utils/asyncHandler');

const JSON_FIELDS = ['sows', 'contact_centers', 'workstreams', 'technologies', 'team_members', 'exclusion_list'];

function parseEngagement(row) {
  if (!row) return null;
  const result = { ...row };
  for (const field of JSON_FIELDS) {
    try { result[field] = JSON.parse(row[field] || '[]'); }
    catch { result[field] = []; }
  }
  return result;
}

function serializeListField(value) {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

// GET / — List all engagements
router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM core_config ORDER BY created_at DESC'
  ).all();
  res.json(rows.map(parseEngagement));
}));

// GET /:id — Single engagement
router.get('/:id', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Engagement not found' });
  res.json(parseEngagement(row));
}));

// POST / — Create engagement (Setup Wizard Step 1)
router.post('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { client_name, engagement_name, start_date } = req.body;

  if (!client_name?.trim() || !engagement_name?.trim()) {
    return res.status(400).json({ error: 'client_name and engagement_name are required' });
  }

  const engagement_id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO core_config
      (engagement_id, client_name, engagement_name, start_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    engagement_id,
    client_name.trim(),
    engagement_name.trim(),
    start_date || null,
    req.user.userId,
    now, now
  );

  logAudit({
    entityType: 'core_config', entityId: engagement_id,
    newValue: { client_name, engagement_name },
    changedBy: req.user.userId, operationType: 'Create',
  });

  const created = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(engagement_id);
  res.status(201).json(parseEngagement(created));
}));

// PUT /:id — Update engagement (Setup wizard subsequent steps + post-setup config)
router.put('/:id', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Engagement not found' });

  const UPDATABLE = [
    'client_name', 'engagement_name', 'start_date', 'status', 'sow_review_status',
    'sows', 'contact_centers', 'workstreams', 'technologies', 'team_members',
    'sharepoint_site_url', 'sharepoint_parent_folder_id', 'instinct_folder_id',
    'session_notes_folder_id', 'exclusion_list',
  ];

  const LIST_FIELDS = new Set(['sows', 'contact_centers', 'workstreams', 'technologies', 'team_members', 'exclusion_list']);

  const updates = {};
  for (const field of UPDATABLE) {
    if (req.body[field] !== undefined) {
      updates[field] = LIST_FIELDS.has(field)
        ? serializeListField(req.body[field])
        : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), req.params.id];

  db.prepare(`UPDATE core_config SET ${setClauses} WHERE engagement_id = ?`).run(...values);

  logAudit({
    entityType: 'core_config', entityId: req.params.id,
    oldValue: parseEngagement(existing), newValue: updates,
    changedBy: req.user.userId, operationType: 'Update',
  });

  const updated = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(req.params.id);
  res.json(parseEngagement(updated));
}));

// GET /:id/stats — Summary stats for engagement dashboard
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const id = req.params.id;

  const exists = db.prepare('SELECT engagement_id FROM core_config WHERE engagement_id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Engagement not found' });

  const count = (table, where = '') =>
    db.prepare(`SELECT COUNT(*) as n FROM ${table} WHERE engagement_id = ? ${where}`).get(id).n;

  res.json({
    findings:          count('findings'),
    findingsNeedReview:count('findings', "AND review_status = 'Needs Review'"),
    questions:         count('questions'),
    questionsOpen:     count('questions', "AND status = 'Open'"),
    stakeholders:      count('stakeholders'),
    artifacts:         count('artifacts'),
    artifactsProcessed:count('artifacts', "AND ingestion_status = 'Processed'"),
    sessions:          count('interview_sessions'),
    pendingSuggestions:count('metadata_suggestions', "AND status = 'Pending'"),
    openActions:       db.prepare(
      "SELECT COUNT(*) as n FROM decisions_actions WHERE engagement_id = ? AND type = 'Action' AND status = 'Open'"
    ).get(id).n,
  });
}));

module.exports = router;
