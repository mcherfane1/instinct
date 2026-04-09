/**
 * Excel export service (PRD §11.1).
 *
 * Produces a multi-sheet workbook mirroring all 8 entity types.
 * Written to SharePoint /Knowledge Model folder and available for local download.
 * Self-documenting: includes a Controlled Vocabulary lookup sheet.
 */

const ExcelJS = require('exceljs');
const { getDatabase } = require('../config/database');

const HEADER_FILL = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF0069B4' }, // Hummingbird blue
};
const HEADER_FONT  = { color: { argb: 'FFFFFFFF' }, bold: true };
const ALT_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };

/**
 * Generate a full Excel workbook for the engagement knowledge model.
 * @param {string} engagementId
 * @returns {Promise<Buffer>} — xlsx file buffer
 */
async function generateExport(engagementId) {
  const db = getDatabase();
  const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(engagementId);
  if (!config) throw Object.assign(new Error('Engagement not found'), { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Hummingbird Instinct';
  wb.created  = new Date();
  wb.modified = new Date();

  const parse = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };

  // ---- Sheet: Findings ----
  addSheet(wb, 'Findings', [
    'Finding ID', 'Finding Text', 'State Tag', 'Workstream', 'Contact Centers',
    'Technologies', 'Source Type', 'Source Artifact', 'Provided By',
    'Confidence', 'Review Status', 'Created By', 'Created At',
  ], db.prepare('SELECT * FROM findings WHERE engagement_id = ?').all(engagementId).map(r => [
    r.finding_id, r.finding_text, r.state_tag, r.workstream,
    parse(r.contact_center).join('; '), parse(r.technology).join('; '),
    r.source_type, r.source_artifact_id, r.provided_by,
    r.confidence, r.review_status, r.created_by, r.created_at,
  ]));

  // ---- Sheet: Q&A ----
  addSheet(wb, 'Questions & Answers', [
    'Question ID', 'Section', 'Question', 'Answer', 'Status',
    'Provided By', 'Source Artifact', 'Date Answered', 'Created At',
  ], db.prepare('SELECT * FROM questions WHERE engagement_id = ?').all(engagementId).map(r => [
    r.question_id, r.section, r.question_text, r.answer_text, r.status,
    r.provided_by, r.source_artifact_id, r.date_answered, r.created_at,
  ]));

  // ---- Sheet: Stakeholders ----
  addSheet(wb, 'Stakeholders', [
    'Stakeholder ID', 'Name', 'Role', 'Organization', 'Relationship',
    'Engagement Level', 'Last Interaction', 'Status', 'Notes',
  ], db.prepare('SELECT * FROM stakeholders WHERE engagement_id = ?').all(engagementId).map(r => [
    r.stakeholder_id, r.name, r.role, r.organization, r.relationship,
    r.engagement_level, r.last_interaction, r.status, r.notes,
  ]));

  // ---- Sheet: Artifacts ----
  addSheet(wb, 'Artifacts', [
    'Artifact ID', 'Name', 'Type', 'Format', 'Date Received',
    'Ingestion Status', 'PHI Flag', 'Summary', 'Provided By', 'Created At',
  ], db.prepare('SELECT * FROM artifacts WHERE engagement_id = ?').all(engagementId).map(r => [
    r.artifact_id, r.name, r.artifact_type, r.file_format, r.date_received,
    r.ingestion_status, r.phi_flag ? 'Yes' : 'No', r.summary, r.provided_by, r.created_at,
  ]));

  // ---- Sheet: Assumptions & Gaps ----
  addSheet(wb, 'Assumptions & Gaps', [
    'Item ID', 'Type', 'Workstream', 'Statement', 'Risk If Wrong',
    'Resolution Plan', 'Owner', 'Status', 'Created At',
  ], db.prepare('SELECT * FROM assumptions_gaps WHERE engagement_id = ?').all(engagementId).map(r => [
    r.item_id, r.type, r.workstream, r.statement, r.risk_if_wrong,
    r.resolution_plan, r.owner, r.status, r.created_at,
  ]));

  // ---- Sheet: Decisions & Actions ----
  addSheet(wb, 'Decisions & Actions', [
    'Item ID', 'Type', 'Workstream', 'Description', 'Owner',
    'Due Date', 'Status', 'Confirmed Date', 'Created At',
  ], db.prepare('SELECT * FROM decisions_actions WHERE engagement_id = ?').all(engagementId).map(r => [
    r.item_id, r.type, r.workstream, r.description, r.owner,
    r.due_date, r.status, r.confirmed_date, r.created_at,
  ]));

  // ---- Sheet: Interview Sessions ----
  addSheet(wb, 'Interview Sessions', [
    'Session ID', 'Name', 'Date', 'Workstream', 'Contact Center',
    'Participants', 'Elapsed (sec)', 'Status', 'Created At',
  ], db.prepare('SELECT * FROM interview_sessions WHERE engagement_id = ?').all(engagementId).map(r => [
    r.session_id, r.name, r.date, r.workstream, r.contact_center,
    parse(r.participants).map(p => p.name).join('; '),
    r.elapsed_seconds, r.status, r.created_at,
  ]));

  // ---- Sheet: Notes ----
  addSheet(wb, 'Notes', [
    'Note ID', 'Session ID', 'Note Type', 'Workstream', 'Contact Center',
    'Technology', 'Speaker', 'Review Status', 'Text', 'Promoted To Finding', 'Created At',
  ], db.prepare('SELECT * FROM notes WHERE engagement_id = ?').all(engagementId).map(r => [
    r.note_id, r.session_id, r.note_type, r.workstream, r.contact_center,
    r.technology, r.speaker, r.review_status, r.text, r.promoted_to_finding_id, r.created_at,
  ]));

  // ---- Sheet: Controlled Vocabulary (lookup) ----
  const cv = wb.addWorksheet('Controlled Vocabulary');
  cv.columns = [
    { header: 'List Name', key: 'list', width: 25 },
    { header: 'Value',     key: 'value', width: 50 },
  ];
  styleHeaderRow(cv);

  const lists = {
    'Workstreams':    parse(config.workstreams),
    'Contact Centers':parse(config.contact_centers),
    'Technologies':   parse(config.technologies),
    'SOWs':           parse(config.sows),
    'State Tags':     ['Current State','Future State','Gap','Recommendation','Decision','Risk','Assumption'],
    'Confidence':     ['High','Medium','Low','Unverified'],
  };
  let cvRow = 2;
  for (const [listName, values] of Object.entries(lists)) {
    for (const val of values) {
      const row = cv.getRow(cvRow++);
      row.values = [listName, val];
      if (cvRow % 2 === 0) {
        row.eachCell(c => { c.fill = ALT_ROW_FILL; });
      }
    }
  }

  // ---- Metadata tab ----
  const meta = wb.addWorksheet('Export Info');
  meta.columns = [{ header: 'Property', key: 'k', width: 30 }, { header: 'Value', key: 'v', width: 50 }];
  styleHeaderRow(meta);
  const rows = [
    ['Engagement',    config.engagement_name],
    ['Client',        config.client_name],
    ['Status',        config.status],
    ['Exported At',   new Date().toISOString()],
    ['Exported By',   'Hummingbird Instinct v1'],
  ];
  rows.forEach((r, i) => {
    const row = meta.getRow(i + 2);
    row.values = r;
  });

  return wb.xlsx.writeBuffer();
}

function addSheet(wb, name, headers, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(h.length + 4, 20) }));
  styleHeaderRow(ws);
  rows.forEach((r, i) => {
    const row = ws.getRow(i + 2);
    row.values = r;
    if (i % 2 === 0) {
      row.eachCell(c => { c.fill = ALT_ROW_FILL; });
    }
  });
  ws.autoFilter = { from: 'A1', to: { row: 1, column: headers.length } };
}

function styleHeaderRow(ws) {
  const header = ws.getRow(1);
  header.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  header.height = 20;
}

module.exports = { generateExport };
