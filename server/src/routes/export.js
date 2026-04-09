/**
 * Export routes (PRD §11).
 * Excel knowledge model, kb.json, session Markdown/JSON.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getDatabase }    = require('../config/database');
const { generateExport } = require('../services/excelExporter');
const asyncHandler       = require('../utils/asyncHandler');

// GET /engagements/:engagementId/export/excel — Full knowledge model Excel export (PRD §11.1)
router.get('/excel', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const config = db.prepare('SELECT engagement_name FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  if (!config) return res.status(404).json({ error: 'Engagement not found' });

  const buffer   = await generateExport(req.params.engagementId);
  const ts       = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const safeName = config.engagement_name.replace(/[^a-z0-9_-]/gi, '_');
  const filename = `Instinct_KnowledgeModel_${safeName}_${ts}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

// GET /engagements/:engagementId/export/kb.json — Full knowledge base JSON export (PRD §11.3)
router.get('/kb.json', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  if (!config) return res.status(404).json({ error: 'Engagement not found' });

  const parse = v => { try { return JSON.parse(v || '[]'); } catch { return []; } };

  const kb = {
    version:        '1.0',
    exported_at:    new Date().toISOString(),
    engagement:     {
      id:      config.engagement_id,
      name:    config.engagement_name,
      client:  config.client_name,
      status:  config.status,
    },
    findings:       db.prepare('SELECT * FROM findings WHERE engagement_id = ?').all(config.engagement_id)
      .map(r => ({ ...r, contact_center: parse(r.contact_center), technology: parse(r.technology), linked_question_ids: parse(r.linked_question_ids) })),
    questions:      db.prepare('SELECT * FROM questions WHERE engagement_id = ?').all(config.engagement_id)
      .map(r => ({ ...r, linked_finding_ids: parse(r.linked_finding_ids) })),
    stakeholders:   db.prepare('SELECT * FROM stakeholders WHERE engagement_id = ?').all(config.engagement_id),
    assumptions:    db.prepare('SELECT * FROM assumptions_gaps WHERE engagement_id = ?').all(config.engagement_id)
      .map(r => ({ ...r, linked_finding_ids: parse(r.linked_finding_ids) })),
    decisions:      db.prepare('SELECT * FROM decisions_actions WHERE engagement_id = ?').all(config.engagement_id)
      .map(r => ({ ...r, linked_ids: parse(r.linked_ids) })),
    artifacts:      db.prepare("SELECT artifact_id, name, artifact_type, ingestion_status, summary FROM artifacts WHERE engagement_id = ?").all(config.engagement_id),
    sessions:       db.prepare('SELECT session_id, name, date, status FROM interview_sessions WHERE engagement_id = ?').all(config.engagement_id),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="kb_${config.engagement_id}.json"`);
  res.json(kb);
}));

// GET /engagements/:engagementId/sessions/:sessionId/export — Session export (PRD §7.1.8)
router.get('/session/:sessionId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const session = db.prepare(
    'SELECT * FROM interview_sessions WHERE session_id = ? AND engagement_id = ?'
  ).get(req.params.sessionId, req.params.engagementId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const notes = db.prepare(
    'SELECT * FROM notes WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.sessionId);

  const format = req.query.format || 'json';

  if (format === 'json') {
    const payload = {
      schema_version: '1.0',
      session_id:     session.session_id,
      engagement_id:  req.params.engagementId,
      name:           session.name,
      date:           session.date,
      participants:   JSON.parse(session.participants || '[]'),
      workstream:     session.workstream,
      contact_center: session.contact_center,
      elapsed_seconds:session.elapsed_seconds,
      canvas_content: session.canvas_content ? JSON.parse(session.canvas_content) : null,
      notes:          notes.map(n => ({
        ...n,
        linked_question_ids: JSON.parse(n.linked_question_ids || '[]'),
      })),
      exported_at: new Date().toISOString(),
    };
    res.setHeader('Content-Disposition', `attachment; filename="${session.session_id}.json"`);
    res.json(payload);

  } else if (format === 'markdown') {
    const lines = [
      `# ${session.name}`,
      `**Date:** ${session.date}  |  **Workstream:** ${session.workstream || 'N/A'}  |  **Contact Center:** ${session.contact_center || 'N/A'}`,
      `**Participants:** ${JSON.parse(session.participants || '[]').map(p => p.name).join(', ') || 'N/A'}`,
      `**Duration:** ${Math.round(session.elapsed_seconds / 60)} minutes`,
      '',
      '---',
      '',
      '## Notes',
      '',
      ...notes.map(n => {
        const typeLabel = n.note_type ? `**[${n.note_type}]**` : '';
        const promoted  = n.promoted_to_finding_id ? ` *(→ ${n.promoted_to_finding_id})*` : '';
        return `${typeLabel} ${n.text}${promoted}`;
      }),
    ];
    const safeName = session.name.replace(/[^a-z0-9_-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${session.date}.md"`);
    res.send(lines.join('\n'));
  } else {
    res.status(400).json({ error: 'format must be json or markdown' });
  }
}));

module.exports = router;
