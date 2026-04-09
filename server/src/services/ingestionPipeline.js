/**
 * Artifact ingestion pipeline (PRD §7.2).
 *
 * Flow (PRD §7.2.2):
 *   1. Duplicate hash check
 *   2. Text extraction (with OCR fallback stub)
 *   3. Send to Claude for structured extraction
 *   4. Write Findings, Q&A answers, Stakeholders to knowledge model
 *   5. Evaluate metadata tags vs. controlled vocabulary
 *   6. Create metadata suggestions for out-of-vocabulary tags
 *   7. Update artifact ingestion_status
 *   8. Index extracted records in vector store
 *
 * All AI-extracted records get review_status = 'Needs Review' (PRD §7.2.2 step 11).
 * PHI-flagged artifacts are never sent to the Claude API (PRD §9.3).
 */

const { getDatabase }       = require('../config/database');
const { logAudit }          = require('../middleware/auditLogger');
const { nextId }            = require('../utils/idGenerator');
const { hashFile }          = require('../utils/hashUtil');
const { extractText, detectFormat } = require('./textExtractor');
const { extractStructured } = require('./aiProxy');
const vectorStore           = require('./vectorStore');

const MAX_CHUNK_CHARS = 80000; // ~20k tokens, safe for most Claude models

/**
 * Main pipeline entry point. Called from the artifacts route after file upload.
 *
 * @param {object} params
 * @param {string} params.artifactId
 * @param {string} params.engagementId
 * @param {string} params.filePath     — absolute local path
 * @param {string} params.fileName
 * @param {string} params.userId       — req.user.userId
 */
async function runIngestion({ artifactId, engagementId, filePath, fileName, userId }) {
  const db = getDatabase();

  function updateStatus(status) {
    db.prepare('UPDATE artifacts SET ingestion_status = ?, updated_at = ? WHERE artifact_id = ?')
      .run(status, new Date().toISOString(), artifactId);
  }

  try {
    updateStatus('Processing');

    // 1. Check for PHI flag
    const artifact = db.prepare('SELECT * FROM artifacts WHERE artifact_id = ?').get(artifactId);
    if (artifact.phi_flag) {
      console.warn(`[Ingestion] Artifact ${artifactId} is PHI-flagged. Skipping AI extraction.`);
      updateStatus('Processed');
      return { skipped: true, reason: 'PHI flag set' };
    }

    // 2. Extract text
    const fileFormat = detectFormat(fileName);
    const { text, ocrRequired, ocrApplied } = await extractText(filePath, fileFormat);

    if (ocrRequired && !ocrApplied) {
      // Phase 1 stub: OCR not implemented
      db.prepare(
        'UPDATE artifacts SET ingestion_status = ?, ocr_applied = 0, updated_at = ? WHERE artifact_id = ?'
      ).run('Failed - OCR Error', new Date().toISOString(), artifactId);
      console.error(`[Ingestion] ${artifactId}: scanned file requires OCR (stub active in Phase 1)`);
      return { error: 'OCR required but not available in Phase 1' };
    }

    if (!text || text.trim().length < 10) {
      updateStatus('Failed');
      return { error: 'Could not extract usable text from file' };
    }

    // 3. Get engagement context for AI prompts
    const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?').get(engagementId);
    const existingQuestions = db.prepare(
      "SELECT question_id, question_text, section FROM questions WHERE engagement_id = ? AND status != 'Closed'"
    ).all(engagementId);
    const existingStakeholders = db.prepare(
      'SELECT stakeholder_id, name FROM stakeholders WHERE engagement_id = ?'
    ).all(engagementId);

    // 4. Chunk if needed
    const chunks = chunkText(text, MAX_CHUNK_CHARS);
    const allResults = { findings: [], qaAnswers: [], stakeholders: [], summary: '' };

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Ingestion] ${artifactId}: processing chunk ${i + 1}/${chunks.length}`);
      const result = await extractFromChunk({
        chunk: chunks[i],
        config,
        existingQuestions,
        existingStakeholders,
        artifactId,
        fileName,
        chunkIndex: i,
        totalChunks: chunks.length,
      });
      mergeResults(allResults, result);
    }

    // 5. Write findings to DB
    const now = new Date().toISOString();
    const writtenFindingIds = [];

    for (const f of allResults.findings) {
      const findingId = nextId('finding');
      db.prepare(`
        INSERT INTO findings
          (finding_id, engagement_id, finding_text, state_tag, workstream,
           contact_center, technology, source_type, source_artifact_id,
           provided_by, confidence, review_status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'AI-Extracted', ?, ?, 'Unverified', 'Needs Review', ?, ?, ?)
      `).run(
        findingId, engagementId, f.finding_text, f.state_tag || null,
        f.workstream || null,
        JSON.stringify(f.contact_center || []),
        JSON.stringify(f.technology || []),
        artifactId, f.provided_by || null, userId, now, now
      );
      writtenFindingIds.push(findingId);

      logAudit({
        entityType: 'findings', entityId: findingId,
        newValue: { source: artifactId, text: f.finding_text },
        changedBy: userId, operationType: 'Create',
      });

      vectorStore.upsert(engagementId, {
        id: findingId, type: 'finding',
        text: f.finding_text,
        metadata: { state_tag: f.state_tag, workstream: f.workstream },
      });
    }

    // 6. Update Q&A answers
    const answeredQIds = [];
    for (const qa of allResults.qaAnswers) {
      if (!qa.question_id) continue;
      const q = db.prepare('SELECT * FROM questions WHERE question_id = ? AND engagement_id = ?')
        .get(qa.question_id, engagementId);
      if (!q) continue;

      db.prepare(`
        UPDATE questions
        SET answer_text = ?, status = 'AI-Answered (Review)', source_artifact_id = ?,
            date_answered = ?, updated_at = ?
        WHERE question_id = ?
      `).run(qa.answer_text, artifactId, now, now, qa.question_id);
      answeredQIds.push(qa.question_id);
    }

    // 7. Add new stakeholders
    const addedStakeholderIds = [];
    const existingNames = new Set(existingStakeholders.map(s => s.name.toLowerCase()));

    for (const stk of allResults.stakeholders) {
      if (existingNames.has((stk.name || '').toLowerCase())) continue;
      const stkId = nextId('stakeholder');
      db.prepare(`
        INSERT INTO stakeholders
          (stakeholder_id, engagement_id, name, role, organization, relationship,
           created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stkId, engagementId, stk.name, stk.role || null,
        stk.organization || null, stk.relationship || 'Unknown',
        userId, now, now
      );
      addedStakeholderIds.push(stkId);
      existingNames.add(stk.name.toLowerCase());
    }

    // 8. Update artifact with summary and status
    db.prepare(`
      UPDATE artifacts
      SET ingestion_status = 'Processed', summary = ?, ocr_applied = ?, updated_at = ?
      WHERE artifact_id = ?
    `).run(allResults.summary || null, ocrApplied ? 1 : 0, now, artifactId);

    logAudit({
      entityType: 'artifacts', entityId: artifactId,
      newValue: { status: 'Processed', findings: writtenFindingIds.length },
      changedBy: userId, operationType: 'Update',
    });

    return {
      findingsCreated:      writtenFindingIds.length,
      questionsAnswered:    answeredQIds.length,
      stakeholdersAdded:    addedStakeholderIds.length,
      findingIds:           writtenFindingIds,
    };

  } catch (err) {
    console.error(`[Ingestion] Pipeline failed for ${artifactId}:`, err.message);

    if (err.status === 503) {
      updateStatus('Pending'); // AI unavailable — queue for retry
    } else if (err.status === 502) {
      updateStatus('Failed - Parse Error');
    } else {
      updateStatus('Failed');
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// AI extraction call
// ---------------------------------------------------------------------------

async function extractFromChunk({
  chunk, config, existingQuestions, existingStakeholders,
  artifactId, fileName, chunkIndex, totalChunks,
}) {
  const system = buildExtractionSystemPrompt(config);
  const prompt = buildExtractionPrompt({
    chunk, existingQuestions, existingStakeholders,
    fileName, chunkIndex, totalChunks,
  });

  const { text } = await extractStructured({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4096,
  });

  return JSON.parse(text);
}

function buildExtractionSystemPrompt(config) {
  return `You are an AI assistant for Hummingbird Instinct, a consulting engagement knowledge management platform.

Engagement: ${config.engagement_name} | Client: ${config.client_name}
Workstreams: ${JSON.parse(config.workstreams || '[]').join(', ') || 'Not defined'}
Contact Centers: ${JSON.parse(config.contact_centers || '[]').join(', ') || 'Not defined'}
Technologies: ${JSON.parse(config.technologies || '[]').join(', ') || 'Not defined'}

Your task: Extract structured knowledge from the provided document text.
Return ONLY valid JSON matching the schema below. No markdown, no commentary.

Schema:
{
  "summary": "<2-3 sentence summary of the document>",
  "findings": [
    {
      "finding_text": "<standalone fact or observation>",
      "state_tag": "<Current State|Future State|Gap|Recommendation|Decision|Risk|Assumption>",
      "workstream": "<from controlled list or null>",
      "contact_center": ["<from controlled list>"],
      "technology": ["<from controlled list>"],
      "provided_by": "<name/role if attributable or null>"
    }
  ],
  "qa_answers": [
    {
      "question_id": "<Q-XXX if answerable, else null>",
      "answer_text": "<the answer found in the document>"
    }
  ],
  "stakeholders": [
    {
      "name": "<full name>",
      "role": "<title or role>",
      "organization": "<client org, HH, or vendor>",
      "relationship": "<Sponsor|Decision Maker|SME|Influencer|Operational Contact|Unknown>"
    }
  ]
}`;
}

function buildExtractionPrompt({ chunk, existingQuestions, existingStakeholders, fileName, chunkIndex, totalChunks }) {
  const qList = existingQuestions.slice(0, 30).map(q => `${q.question_id}: ${q.question_text}`).join('\n');
  const stkList = existingStakeholders.map(s => s.name).join(', ');

  return `Document: ${fileName} (chunk ${chunkIndex + 1} of ${totalChunks})

${existingQuestions.length > 0 ? `Open questions to answer if possible:\n${qList}\n` : ''}
${existingStakeholders.length > 0 ? `Known stakeholders (do not re-add): ${stkList}\n` : ''}

--- DOCUMENT TEXT ---
${chunk}
--- END TEXT ---

Extract all findings, Q&A answers, new stakeholders, and a document summary.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkText(text, maxChars) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  const overlap = Math.floor(maxChars * 0.1); // 10% overlap for context continuity
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

function mergeResults(acc, result) {
  if (result.summary && !acc.summary) acc.summary = result.summary;

  // Deduplicate findings by text similarity (simple: exact match)
  const existingTexts = new Set(acc.findings.map(f => f.finding_text.toLowerCase().trim()));
  for (const f of (result.findings || [])) {
    if (!existingTexts.has(f.finding_text.toLowerCase().trim())) {
      acc.findings.push(f);
      existingTexts.add(f.finding_text.toLowerCase().trim());
    }
  }

  for (const qa of (result.qa_answers || [])) {
    if (!acc.qaAnswers.find(a => a.question_id === qa.question_id)) {
      acc.qaAnswers.push(qa);
    }
  }

  const existingNames = new Set(acc.stakeholders.map(s => s.name.toLowerCase()));
  for (const stk of (result.stakeholders || [])) {
    if (!existingNames.has(stk.name.toLowerCase())) {
      acc.stakeholders.push(stk);
      existingNames.add(stk.name.toLowerCase());
    }
  }
}

module.exports = { runIngestion };
