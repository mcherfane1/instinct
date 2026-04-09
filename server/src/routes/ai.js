/**
 * AI proxy routes (PRD §10).
 * ALL Claude API calls from the client flow through here — never directly.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });

const { getDatabase }       = require('../config/database');
const { requireEngagementLead } = require('../middleware/rbac');
const { callClaude, queryKnowledgeBase, extractStructured } = require('../services/aiProxy');
const vectorStore           = require('../services/vectorStore');
const asyncHandler          = require('../utils/asyncHandler');

// GET /ai/status — Check if AI is available
router.get('/status', (req, res) => {
  res.json({
    available: !!process.env.ANTHROPIC_API_KEY,
    model:     process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
  });
});

// POST /engagements/:engagementId/ai/knowledge-hub/query — Knowledge Hub NL query (PRD §7.3)
router.post('/knowledge-hub/query', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query is required' });

  const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  if (!config) return res.status(404).json({ error: 'Engagement not found' });

  // Retrieve relevant records (RAG or full-KB depending on size)
  const records = vectorStore.search(req.params.engagementId, query);

  // Build context from retrieved records
  const contextBlocks = records.map(r =>
    `[${r.type.toUpperCase()} ${r.id}] ${r.text}`
  ).join('\n\n');

  const system = `You are the Knowledge Hub for Hummingbird Instinct, a consulting engagement knowledge management system.
Engagement: ${config.engagement_name} | Client: ${config.client_name}

Answer questions about this consulting engagement based ONLY on the knowledge base records provided.
Rules:
• Reference specific record IDs (FND-001, STK-003, Q-045) when citing sources.
• Use plain prose. No markdown headers.
• If evidence is limited or conflicting, include a confidence note.
• If you cannot answer from the provided context, say so clearly.`;

  const prompt = `Knowledge Base Records:\n${contextBlocks || '(No records found for this query)'}\n\nQuestion: ${query}`;

  const { text } = await queryKnowledgeBase({
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  res.json({ answer: text, recordsSearched: records.length });
}));

// POST /engagements/:engagementId/ai/session-review — AI Metadata Review on session close (PRD §7.1.6)
router.post('/session-review', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { sessionId, canvasText, participants } = req.body;
  if (!sessionId || !canvasText) {
    return res.status(400).json({ error: 'sessionId and canvasText are required' });
  }

  const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  const existingQuestions = db.prepare(
    "SELECT question_id, question_text FROM questions WHERE engagement_id = ? AND status NOT IN ('Closed', 'Answered')"
  ).all(req.params.engagementId);
  const existingStakeholders = db.prepare(
    'SELECT stakeholder_id, name FROM stakeholders WHERE engagement_id = ?'
  ).all(req.params.engagementId);

  const system = `You are an AI assistant for Hummingbird Instinct. Analyze interview session notes and propose structured metadata.
Engagement: ${config.engagement_name} | Client: ${config.client_name}
Workstreams: ${JSON.parse(config.workstreams || '[]').join(', ')}
Contact Centers: ${JSON.parse(config.contact_centers || '[]').join(', ')}

Return ONLY valid JSON. No markdown.`;

  const prompt = `Interview session notes:
---
${canvasText}
---

Participants: ${JSON.stringify(participants || [])}
Open questions: ${existingQuestions.slice(0, 20).map(q => `${q.question_id}: ${q.question_text}`).join('\n')}
Known stakeholders: ${existingStakeholders.map(s => s.name).join(', ')}

Return JSON:
{
  "block_proposals": [
    {"text_excerpt": "<first 80 chars>", "note_type": "<type>", "workstream": "<or null>", "contact_center": "<or null>"}
  ],
  "candidate_findings": [
    {"finding_text": "<standalone fact>", "state_tag": "<tag>", "workstream": "<or null>", "confidence": "<High|Medium|Low>"}
  ],
  "candidate_qa_answers": [
    {"question_id": "<Q-XXX>", "answer_text": "<answer found in notes>"}
  ],
  "candidate_new_questions": [
    {"question_text": "<text from ? prefix>", "suggested_section": "<section or null>"}
  ],
  "new_stakeholders": [
    {"name": "<name>", "role": "<role or null>", "organization": "<org or null>"}
  ]
}`;

  const { text } = await extractStructured({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4096,
  });

  res.json(JSON.parse(text));
}));

// POST /engagements/:engagementId/ai/sow-analysis — Setup Step 4 (PRD §8.2)
router.post('/sow-analysis', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { sowText } = req.body;
  if (!sowText?.trim()) return res.status(400).json({ error: 'sowText is required' });

  const config = db.prepare('SELECT client_name, engagement_name FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);

  const system = `You are analyzing a Statement of Work for a healthcare consulting engagement.
Extract structured information to seed the engagement configuration.
Return ONLY valid JSON. No markdown.`;

  const prompt = `Client: ${config?.client_name || 'Unknown'}
Engagement: ${config?.engagement_name || 'Unknown'}

SOW Text:
---
${sowText.slice(0, 30000)}
---

Return JSON:
{
  "workstreams": ["<workstream names from SOW>"],
  "contact_centers": ["<contact center names>"],
  "technologies": ["<technology names mentioned>"],
  "scope_summary": "<2-3 sentences describing engagement scope>",
  "key_deliverables": ["<deliverable names>"],
  "out_of_scope": ["<explicitly out-of-scope items>"]
}`;

  const { text } = await extractStructured({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
  });

  res.json(JSON.parse(text));
}));

// POST /engagements/:engagementId/ai/generate-questions — Setup Step 6 (PRD §8.2)
router.post('/generate-questions', requireEngagementLead, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const config = db.prepare('SELECT * FROM core_config WHERE engagement_id = ?')
    .get(req.params.engagementId);
  if (!config) return res.status(404).json({ error: 'Engagement not found' });

  const system = `You are generating discovery questions for a healthcare consulting engagement.
Generate insightful, specific questions based on the engagement scope.
Return ONLY valid JSON. No markdown.`;

  const prompt = `Engagement: ${config.engagement_name}
Client: ${config.client_name}
Workstreams: ${JSON.parse(config.workstreams || '[]').join(', ')}
Contact Centers: ${JSON.parse(config.contact_centers || '[]').join(', ')}
Technologies: ${JSON.parse(config.technologies || '[]').join(', ')}

Generate 15-25 targeted discovery questions organized by section.
Return JSON: {"questions": [{"section": "<section>", "question_text": "<question>"}]}`;

  const { text } = await extractStructured({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 3000,
  });

  res.json(JSON.parse(text));
}));

module.exports = router;
