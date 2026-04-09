/**
 * Metadata suggestion routes (PRD §6).
 * Pending Approvals screen — Engagement Lead only.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase }           = require('../config/database');
const { requireEngagementLead } = require('../middleware/rbac');
const { approveSuggestion, denySuggestion } = require('../services/metadataWorkflow');
const asyncHandler              = require('../utils/asyncHandler');

function parse(row) {
  if (!row) return null;
  return { ...row, affected_record_ids: JSON.parse(row.affected_record_ids || '[]') };
}

// GET /engagements/:engagementId/metadata/suggestions
router.get('/suggestions', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { status } = req.query;
  let sql = 'SELECT * FROM metadata_suggestions WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  else        { sql += " AND status = 'Pending'"; }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(parse));
}));

// GET /engagements/:engagementId/metadata/suggestions/count
router.get('/suggestions/count', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const row = db.prepare(
    "SELECT COUNT(*) as n FROM metadata_suggestions WHERE engagement_id = ? AND status = 'Pending'"
  ).get(req.params.engagementId);
  res.json({ pending: row.n });
}));

// POST /engagements/:engagementId/metadata/suggestions/:suggestionId/approve
router.post('/suggestions/:suggestionId/approve', requireEngagementLead, asyncHandler(async (req, res) => {
  const result = await approveSuggestion(req.params.suggestionId, req.user.userId);
  res.json(result);
}));

// POST /engagements/:engagementId/metadata/suggestions/:suggestionId/deny
router.post('/suggestions/:suggestionId/deny', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const config = db.prepare('SELECT engagement_name, client_name FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  const context = config ? `${config.engagement_name} for ${config.client_name}` : '';
  const result  = await denySuggestion(req.params.suggestionId, req.user.userId, context);
  res.json(result);
}));

// POST /engagements/:engagementId/metadata/suggestions/:suggestionId/assign
// Manual assignment for Unclassified records (PRD §6.2 — Edge Case)
router.post('/suggestions/:suggestionId/assign', requireEngagementLead, asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const { assigned_value } = req.body;
  if (!assigned_value) return res.status(400).json({ error: 'assigned_value is required' });

  const suggestion = db.prepare(
    'SELECT * FROM metadata_suggestions WHERE suggestion_id = ?'
  ).get(req.params.suggestionId);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE metadata_suggestions
    SET status = 'Denied', reconfirm_value = ?, reconfirm_status = 'Auto-Committed',
        reviewed_by = ?, reviewed_at = ?
    WHERE suggestion_id = ?
  `).run(assigned_value, req.user.userId, now, req.params.suggestionId);

  res.json({ ok: true, assigned_value });
}));

module.exports = router;
