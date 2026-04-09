/**
 * Vector / semantic store — Phase 1 in-memory implementation.
 *
 * Phase 3: Replace this module with Azure AI Search client.
 *          The public API (upsert, search, remove) must remain identical
 *          so callers require no changes.
 *
 * Phase 1 strategy: simple TF-IDF-style keyword scoring.
 *   - Adequate for small knowledge bases during local dev.
 *   - The RAG threshold (PRD §10.5) is still respected:
 *     if KB < RAG_THRESHOLD findings, the full KB is passed to Claude directly.
 *
 * Records indexed: Findings, Q&A, Stakeholders, Assumptions/Gaps (PRD §10.5).
 */

const RAG_THRESHOLD = parseInt(process.env.RAG_THRESHOLD || '200', 10);
const TOP_K         = parseInt(process.env.VECTOR_SEARCH_TOP_K || '50', 10);

// engagementId → Map<recordId, {id, type, text, metadata}>
const store = new Map();

/**
 * Insert or update a record in the index.
 * @param {string} engagementId
 * @param {{ id: string, type: string, text: string, metadata: object }} record
 */
function upsert(engagementId, record) {
  if (!store.has(engagementId)) store.set(engagementId, new Map());
  store.get(engagementId).set(record.id, record);
}

/**
 * Remove a record from the index.
 */
function remove(engagementId, recordId) {
  store.get(engagementId)?.delete(recordId);
}

/**
 * Search the index. Returns the top-K most relevant records.
 * If total records < RAG_THRESHOLD, returns ALL records (full-KB mode).
 *
 * @param {string} engagementId
 * @param {string} query
 * @param {number} [topK]
 * @returns {Array<{id, type, text, metadata, score}>}
 */
function search(engagementId, query, topK = TOP_K) {
  const engagementStore = store.get(engagementId);
  if (!engagementStore || engagementStore.size === 0) return [];

  const allRecords = Array.from(engagementStore.values());

  // Full-KB mode: below RAG threshold, return everything
  if (allRecords.length <= RAG_THRESHOLD) {
    return allRecords.map(r => ({ ...r, score: 1 }));
  }

  // Keyword scoring
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)
    .map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));

  const scored = allRecords
    .map(record => {
      const text  = (record.text || '').toLowerCase();
      let score   = 0;
      for (const term of terms) {
        const matches = text.match(term);
        if (matches) score += matches.length;
      }
      return { ...record, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Get total record count for an engagement (used to decide RAG vs full-KB).
 */
function count(engagementId) {
  return store.get(engagementId)?.size ?? 0;
}

/**
 * Clear all records for an engagement (e.g. on engagement deletion).
 */
function clearEngagement(engagementId) {
  store.delete(engagementId);
}

module.exports = { upsert, remove, search, count, clearEngagement };
