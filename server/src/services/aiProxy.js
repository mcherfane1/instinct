/**
 * Claude API proxy service (PRD §10.4).
 *
 * All Claude API calls route through this module — never called directly
 * from client-side code. In production, this becomes an Azure Function.
 *
 * Features:
 *   • Checks for API key on every call (graceful 503 if missing)
 *   • Exponential backoff with max 3 retries (PRD §10.4)
 *   • Rate limit handling (429 → retry)
 *   • Validates JSON responses for extraction touchpoints
 */

const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL       = process.env.ANTHROPIC_MODEL       || 'claude-opus-4-6';
const DEFAULT_QUERY_MODEL = process.env.ANTHROPIC_QUERY_MODEL || 'claude-opus-4-6';
const MAX_RETRIES         = 3;
const BASE_DELAY_MS       = 1000;

let _client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      'ANTHROPIC_API_KEY is not configured. AI features are unavailable. ' +
      'Add the key to your .env file and restart the server.'
    );
    err.status = 503;
    throw err;
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Core message call with exponential backoff.
 *
 * @param {object} params
 * @param {string} params.system          — System prompt
 * @param {Array}  params.messages        — Message array
 * @param {string} [params.model]         — Model override
 * @param {number} [params.maxTokens]     — Max output tokens
 * @param {boolean} [params.expectJson]   — If true, validates that response is parseable JSON
 * @returns {Promise<{text: string, usage: object}>}
 */
async function callClaude({ system, messages, model, maxTokens = 4096, expectJson = false }) {
  const client    = getClient();
  const useModel  = model || DEFAULT_MODEL;

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model:      useModel,
        max_tokens: maxTokens,
        system,
        messages,
      });

      const text = response.content[0]?.text ?? '';

      if (expectJson) {
        // Strip markdown code fences if Claude wrapped the JSON
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        try {
          JSON.parse(cleaned); // Validate parseable
          return { text: cleaned, usage: response.usage };
        } catch {
          throw Object.assign(
            new Error('Claude returned malformed JSON. Raw response preserved in logs.'),
            { status: 502, rawResponse: text }
          );
        }
      }

      return { text, usage: response.usage };

    } catch (err) {
      lastError = err;

      // Don't retry on config errors or JSON validation failures
      if (err.status === 503 || err.status === 502) throw err;

      // Retry on rate limits and transient server errors
      const isRetryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!isRetryable || attempt === MAX_RETRIES - 1) throw err;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[AI] Attempt ${attempt + 1} failed (${err.status}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Convenience wrapper for Knowledge Hub queries (uses query-optimized model).
 */
async function queryKnowledgeBase({ system, messages, maxTokens = 2048 }) {
  return callClaude({ system, messages, model: DEFAULT_QUERY_MODEL, maxTokens, expectJson: false });
}

/**
 * Convenience wrapper for structured extraction (always expects JSON back).
 */
async function extractStructured({ system, messages, maxTokens = 4096 }) {
  return callClaude({ system, messages, maxTokens, expectJson: true });
}

module.exports = { callClaude, queryKnowledgeBase, extractStructured };
