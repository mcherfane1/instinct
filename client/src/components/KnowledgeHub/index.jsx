/**
 * Knowledge Hub — PRD §7.3
 * Natural-language query over the full engagement knowledge base + faceted browse.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  aiApi,
  assumptionApi,
  findingApi,
  questionApi,
  stakeholderApi,
} from '../../api/client';
import useEngagementStore from '../../store/engagementStore';
import Spinner from '../common/Spinner';

// Regex to find entity IDs inline in AI answer text
const ID_REGEX = /\b(FND|Q|STK|ART|ASM|GAP|ACT|DEC)-\d{3,}\b/g;

const EXAMPLE_QUERIES = [
  'What are the key findings about the current state?',
  'Which questions are still open and unanswered?',
  'Who are the key stakeholders and their roles?',
  'What assumptions have been logged so far?',
  'What technology gaps have been identified?',
];

const ENTITY_TYPES = [
  { value: 'all',         label: 'All' },
  { value: 'finding',     label: 'Findings' },
  { value: 'question',    label: 'Questions' },
  { value: 'stakeholder', label: 'Stakeholders' },
  { value: 'assumption',  label: 'Assumptions' },
  { value: 'gap',         label: 'Gaps' },
];

const CONFIDENCE_OPTS   = ['High', 'Medium', 'Low', 'Unverified'];
const STATE_TAG_OPTS    = ['Current State', 'Future State', 'Gap', 'Recommendation', 'Decision', 'Risk', 'Assumption'];
const Q_STATUS_OPTS     = ['Open', 'Partially Answered', 'Answered', 'AI-Answered (Review)', 'Closed'];

// ---------------------------------------------------------------------------
// Normalize all entity types to a common record shape
// ---------------------------------------------------------------------------
function normalizeRecords(findings, questions, stakeholders, assumptions) {
  const out = [];

  for (const f of findings) {
    out.push({
      id:       f.finding_id,
      type:     'finding',
      title:    f.finding_text,
      tag1:     f.state_tag,
      tag2:     f.workstream,
      tag3:     f.confidence,
      badge:    f.review_status,
      raw:      f,
    });
  }

  for (const q of questions) {
    out.push({
      id:       q.question_id,
      type:     'question',
      title:    q.question_text,
      subtitle: q.answer_text || null,
      tag1:     q.section,
      tag2:     q.status,
      raw:      q,
    });
  }

  for (const s of stakeholders) {
    out.push({
      id:       s.stakeholder_id,
      type:     'stakeholder',
      title:    s.name,
      subtitle: [s.role, s.organization].filter(Boolean).join(' · '),
      tag1:     s.relationship,
      tag2:     s.engagement_level,
      raw:      s,
    });
  }

  for (const a of assumptions) {
    out.push({
      id:       a.item_id,
      type:     a.type?.toLowerCase() === 'gap' ? 'gap' : 'assumption',
      title:    a.statement,
      tag1:     a.workstream,
      tag2:     a.status,
      raw:      a,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Parse AI answer text: split on entity IDs, return an array of
// { text: string } | { id: string } segments for rendering
// ---------------------------------------------------------------------------
function parseAnswerSegments(text) {
  if (!text) return [];
  const segments = [];
  let last = 0;
  let match;
  const re = new RegExp(ID_REGEX.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ id: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KnowledgeHub() {
  const { currentEngagement } = useEngagementStore();
  const engagementId = currentEngagement?.engagement_id;

  // Query state
  const [query, setQuery]                 = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [answer, setAnswer]               = useState(null);
  const [recordsSearched, setRecordsSearched] = useState(0);
  const [isQuerying, setIsQuerying]       = useState(false);
  const [queryError, setQueryError]       = useState(null);
  const [aiAvailable, setAiAvailable]     = useState(null);

  // Browse state
  const [allRecords, setAllRecords]       = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);

  // Facets
  const [filters, setFilters] = useState({
    entityType: 'all',
    workstream: '',
    stateTag:   '',
    confidence: '',
    qStatus:    '',
  });

  // Detail panel
  const [selectedId, setSelectedId]       = useState(null);

  const inputRef = useRef(null);

  const wsOptions = currentEngagement?.workstreams
    ? JSON.parse(currentEngagement.workstreams) : [];

  // Load AI availability + all records
  useEffect(() => {
    if (!engagementId) return;
    aiApi.status().then(r => setAiAvailable(r.data.available)).catch(() => setAiAvailable(false));
    loadRecords();
  }, [engagementId]);

  const loadRecords = useCallback(async () => {
    if (!engagementId) return;
    setIsLoadingRecords(true);
    try {
      const [fRes, qRes, sRes, aRes] = await Promise.all([
        findingApi.list(engagementId),
        questionApi.list(engagementId),
        stakeholderApi.list(engagementId),
        assumptionApi.list(engagementId),
      ]);
      setAllRecords(normalizeRecords(
        fRes.data  || [],
        qRes.data  || [],
        sRes.data  || [],
        aRes.data  || [],
      ));
    } catch (err) {
      console.error('KnowledgeHub: failed to load records', err.message);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [engagementId]);

  // Filter records for browse panel
  const filteredRecords = allRecords.filter(r => {
    if (filters.entityType !== 'all' && r.type !== filters.entityType) return false;
    if (filters.workstream && r.raw?.workstream !== filters.workstream) return false;
    if (filters.stateTag && r.raw?.state_tag !== filters.stateTag) return false;
    if (filters.confidence && r.raw?.confidence !== filters.confidence) return false;
    if (filters.qStatus && r.raw?.status !== filters.qStatus) return false;
    return true;
  });

  // Active filter count for badge
  const activeFilterCount = Object.entries(filters)
    .filter(([k, v]) => k !== 'entityType' && v).length;

  async function handleQuery(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setIsQuerying(true);
    setQueryError(null);
    setAnswer(null);
    setSubmittedQuery(q);
    setSelectedId(null);
    try {
      const res = await aiApi.knowledgeQuery(engagementId, q);
      setAnswer(res.data.answer);
      setRecordsSearched(res.data.recordsSearched || 0);
    } catch (err) {
      setQueryError(err.message || 'Query failed. Check that the AI service is available.');
    } finally {
      setIsQuerying(false);
    }
  }

  function useExample(q) {
    setQuery(q);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function clearQuery() {
    setQuery('');
    setAnswer(null);
    setSubmittedQuery('');
    setQueryError(null);
    setSelectedId(null);
    inputRef.current?.focus();
  }

  // Find a record by its ID string
  const selectedRecord = selectedId
    ? allRecords.find(r => r.id === selectedId) ?? null
    : null;

  const hasAnswer = !!answer;
  const hasRecords = allRecords.length > 0;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left Facet Rail ──────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Browse</span>
            {activeFilterCount > 0 && (
              <span className="ml-auto text-xs text-hbird-600 font-medium">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="px-3 py-3 space-y-4 flex-1">

          {/* Entity type */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Entity Type</p>
            <div className="space-y-0.5">
              {ENTITY_TYPES.map(et => {
                const count = et.value === 'all'
                  ? allRecords.length
                  : allRecords.filter(r => r.type === et.value).length;
                return (
                  <button
                    key={et.value}
                    onClick={() => setFilters(f => ({ ...f, entityType: et.value }))}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                      filters.entityType === et.value
                        ? 'bg-hbird-50 text-hbird-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{et.label}</span>
                    {count > 0 && (
                      <span className="text-[10px] text-gray-400">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workstream */}
          {wsOptions.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Workstream</p>
              <select
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
                value={filters.workstream}
                onChange={e => setFilters(f => ({ ...f, workstream: e.target.value }))}
              >
                <option value="">All</option>
                {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
              </select>
            </div>
          )}

          {/* State tag — findings only */}
          {(filters.entityType === 'all' || filters.entityType === 'finding') && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">State Tag</p>
              <select
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
                value={filters.stateTag}
                onChange={e => setFilters(f => ({ ...f, stateTag: e.target.value }))}
              >
                <option value="">All</option>
                {STATE_TAG_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Confidence — findings only */}
          {(filters.entityType === 'all' || filters.entityType === 'finding') && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Confidence</p>
              <select
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
                value={filters.confidence}
                onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
              >
                <option value="">All</option>
                {CONFIDENCE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Q status — questions only */}
          {(filters.entityType === 'all' || filters.entityType === 'question') && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Q Status</p>
              <select
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
                value={filters.qStatus}
                onChange={e => setFilters(f => ({ ...f, qStatus: e.target.value }))}
              >
                <option value="">All</option>
                {Q_STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({ entityType: 'all', workstream: '', stateTag: '', confidence: '', qStatus: '' })}
              className="w-full text-xs text-red-500 hover:text-red-700 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </aside>

      {/* ── Center Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">

          {/* Query bar */}
          <form onSubmit={handleQuery} className="mb-6">
            <div className="relative flex items-center">
              <MagnifyingGlassIcon className="absolute left-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={
                  aiAvailable === false
                    ? 'AI unavailable — configure ANTHROPIC_API_KEY to enable queries'
                    : 'Ask anything about this engagement…'
                }
                disabled={aiAvailable === false || isQuerying}
                className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent
                  disabled:bg-gray-50 disabled:text-gray-400 shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="absolute right-12 text-gray-300 hover:text-gray-500 p-1"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || isQuerying || aiAvailable === false}
                className="absolute right-2 flex items-center justify-center w-8 h-8 rounded-lg
                  bg-hbird-600 text-white hover:bg-hbird-700 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors"
              >
                {isQuerying
                  ? <Spinner size="sm" className="text-white" />
                  : <PaperAirplaneIcon className="h-4 w-4" />
                }
              </button>
            </div>

            {/* AI unavailable warning */}
            {aiAvailable === false && (
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                AI queries require <code className="font-mono">ANTHROPIC_API_KEY</code> in server/.env. Browse mode below is still available.
              </div>
            )}
          </form>

          {/* Example queries — only shown when no answer and AI available */}
          {!hasAnswer && !isQuerying && aiAvailable !== false && (
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map(q => (
                  <button
                    key={q}
                    onClick={() => useExample(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600
                      hover:border-hbird-300 hover:text-hbird-700 hover:bg-hbird-50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Query loading */}
          {isQuerying && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 flex items-center gap-3 shadow-sm">
              <Spinner size="md" />
              <div>
                <p className="text-sm font-medium text-gray-700">Searching knowledge base…</p>
                <p className="text-xs text-gray-400 mt-0.5">Analyzing records across all entity types</p>
              </div>
            </div>
          )}

          {/* Query error */}
          {queryError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Query failed</p>
                <p className="text-xs text-red-600 mt-0.5">{queryError}</p>
              </div>
            </div>
          )}

          {/* AI Answer */}
          {hasAnswer && (
            <div className="bg-white border border-hbird-200 rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-hbird-50 border-b border-hbird-100">
                <SparklesIcon className="h-4 w-4 text-hbird-600" />
                <span className="text-xs font-semibold text-hbird-700">AI Answer</span>
                <span className="ml-auto text-xs text-hbird-500">
                  {recordsSearched} record{recordsSearched !== 1 ? 's' : ''} searched
                </span>
                <button
                  onClick={clearQuery}
                  className="text-hbird-400 hover:text-hbird-700 ml-2"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-5 py-4">
                {submittedQuery && (
                  <p className="text-xs text-gray-400 italic mb-3">"{submittedQuery}"</p>
                )}
                <AnswerText
                  text={answer}
                  onIdClick={id => setSelectedId(prev => prev === id ? null : id)}
                  selectedId={selectedId}
                />
              </div>
            </div>
          )}

          {/* Browse header */}
          <div className="flex items-center gap-2 mb-3">
            <BookOpenIcon className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Knowledge Base
            </h2>
            {!isLoadingRecords && (
              <span className="ml-auto text-xs text-gray-400">
                {filteredRecords.length} of {allRecords.length} record{allRecords.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Browse loading */}
          {isLoadingRecords && (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          )}

          {/* Browse empty — no records at all */}
          {!isLoadingRecords && allRecords.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpenIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-gray-500">No records yet</p>
              <p className="text-xs mt-1">
                Upload artifacts or conduct interview sessions to populate the knowledge base.
              </p>
            </div>
          )}

          {/* Browse filtered empty */}
          {!isLoadingRecords && allRecords.length > 0 && filteredRecords.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No records match the selected filters.</p>
              <button
                onClick={() => setFilters({ entityType: 'all', workstream: '', stateTag: '', confidence: '', qStatus: '' })}
                className="text-xs text-hbird-600 hover:underline mt-1"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Record cards */}
          {!isLoadingRecords && filteredRecords.length > 0 && (
            <div className="space-y-2">
              {filteredRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={selectedId === record.id}
                  onClick={() => setSelectedId(prev => prev === record.id ? null : record.id)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Right Detail Panel ────────────────────────────────────────── */}
      {selectedId && (
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detail</span>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {selectedRecord
            ? <DetailPanel record={selectedRecord} />
            : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400">
                  Record <span className="font-mono text-hbird-500">{selectedId}</span> not found in loaded records.
                </p>
              </div>
            )
          }
        </aside>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer text — renders plain text with inline entity IDs as clickable chips
// ---------------------------------------------------------------------------
function AnswerText({ text, onIdClick, selectedId }) {
  const segments = parseAnswerSegments(text);
  return (
    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.id ? (
          <button
            key={i}
            onClick={() => onIdClick(seg.id)}
            className={`inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded text-xs font-mono font-medium
              border transition-colors ${
                selectedId === seg.id
                  ? 'bg-hbird-100 border-hbird-400 text-hbird-700'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-hbird-50 hover:border-hbird-300 hover:text-hbird-700'
              }`}
          >
            {seg.id}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Record card
// ---------------------------------------------------------------------------

const TYPE_CFG = {
  finding:     { label: 'Finding',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  question:    { label: 'Question',    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  stakeholder: { label: 'Stakeholder', cls: 'bg-green-50 text-green-700 border-green-200' },
  assumption:  { label: 'Assumption',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  gap:         { label: 'Gap',         cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const CONFIDENCE_CLS = {
  High:       'text-green-700 bg-green-50',
  Medium:     'text-yellow-700 bg-yellow-50',
  Low:        'text-orange-700 bg-orange-50',
  Unverified: 'text-gray-500 bg-gray-100',
};

const REVIEW_CLS = {
  Confirmed:    'text-green-700 bg-green-50',
  'Needs Review': 'text-amber-700 bg-amber-50',
  Rejected:     'text-red-700 bg-red-50',
  Superseded:   'text-gray-500 bg-gray-100',
};

const Q_STATUS_CLS = {
  Open:                    'text-red-600 bg-red-50',
  'Partially Answered':    'text-amber-700 bg-amber-50',
  Answered:                'text-green-700 bg-green-50',
  'AI-Answered (Review)':  'text-blue-700 bg-blue-50',
  Closed:                  'text-gray-500 bg-gray-100',
};

function RecordCard({ record, isSelected, onClick }) {
  const typeCfg = TYPE_CFG[record.type] || TYPE_CFG.finding;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all duration-100 group ${
        isSelected
          ? 'border-hbird-300 bg-hbird-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-hbird-200 hover:shadow-sm'
      }`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {/* Type badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeCfg.cls}`}>
              {typeCfg.label}
            </span>
            {/* ID */}
            <span className="text-[10px] font-mono text-hbird-400">{record.id}</span>
            {/* Confidence */}
            {record.type === 'finding' && record.raw?.confidence && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_CLS[record.raw.confidence] || ''}`}>
                {record.raw.confidence}
              </span>
            )}
            {/* Review status */}
            {record.type === 'finding' && record.raw?.review_status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${REVIEW_CLS[record.raw.review_status] || ''}`}>
                {record.raw.review_status}
              </span>
            )}
            {/* Q status */}
            {record.type === 'question' && record.raw?.status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${Q_STATUS_CLS[record.raw.status] || ''}`}>
                {record.raw.status}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm text-gray-800 leading-snug line-clamp-3">
            {record.title}
          </p>

          {/* Subtitle — answer text or role/org */}
          {record.subtitle && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-snug">
              {record.subtitle}
            </p>
          )}

          {/* Tags row */}
          {(record.tag1 || record.tag2) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {record.tag1 && (
                <span className="text-[10px] text-gray-500">{record.tag1}</span>
              )}
              {record.tag1 && record.tag2 && (
                <span className="text-gray-300 text-[10px]">·</span>
              )}
              {record.tag2 && (
                <span className="text-[10px] text-gray-400">{record.tag2}</span>
              )}
            </div>
          )}
        </div>

        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${
            isSelected ? 'text-hbird-500' : 'text-gray-300 group-hover:text-hbird-400'
          }`}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel — full field set for selected record
// ---------------------------------------------------------------------------
function DetailPanel({ record }) {
  const r = record.raw;
  const typeCfg = TYPE_CFG[record.type] || TYPE_CFG.finding;

  return (
    <div className="px-4 py-4 space-y-4 text-xs">
      {/* ID + type */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${typeCfg.cls}`}>
          {typeCfg.label}
        </span>
        <span className="font-mono text-hbird-500 font-semibold">{record.id}</span>
      </div>

      {/* FINDING fields */}
      {record.type === 'finding' && (
        <>
          <Field label="Finding" value={r.finding_text} large />
          <Field label="State Tag" value={r.state_tag} />
          <Field label="Workstream" value={r.workstream} />
          <Field label="Contact Center" value={Array.isArray(r.contact_center) ? r.contact_center.join(', ') : r.contact_center} />
          <Field label="Confidence" value={r.confidence} />
          <Field label="Review Status" value={r.review_status} />
          <Field label="Source Type" value={r.source_type} />
          <Field label="Provided By" value={r.provided_by} />
          {r.source_artifact_id && <Field label="Source Artifact" value={r.source_artifact_id} mono />}
          {r.source_note_id && <Field label="Source Note" value={r.source_note_id} mono />}
          {r.linked_question_ids?.length > 0 && (
            <Field label="Linked Questions" value={r.linked_question_ids.join(', ')} mono />
          )}
        </>
      )}

      {/* QUESTION fields */}
      {record.type === 'question' && (
        <>
          <Field label="Question" value={r.question_text} large />
          <Field label="Status" value={r.status} />
          <Field label="Section" value={r.section} />
          <Field label="Answer" value={r.answer_text} large />
          <Field label="Provided By" value={r.provided_by} />
          <Field label="Date Answered" value={r.date_answered} />
          {r.source_artifact_id && <Field label="Source Artifact" value={r.source_artifact_id} mono />}
          {r.linked_finding_ids?.length > 0 && (
            <Field label="Linked Findings" value={r.linked_finding_ids.join(', ')} mono />
          )}
        </>
      )}

      {/* STAKEHOLDER fields */}
      {record.type === 'stakeholder' && (
        <>
          <Field label="Name" value={r.name} large />
          <Field label="Role" value={r.role} />
          <Field label="Organization" value={r.organization} />
          <Field label="Relationship" value={r.relationship} />
          <Field label="Engagement Level" value={r.engagement_level} />
          <Field label="Status" value={r.status} />
          <Field label="Last Interaction" value={r.last_interaction} />
          <Field label="Notes" value={r.notes} large />
        </>
      )}

      {/* ASSUMPTION / GAP fields */}
      {(record.type === 'assumption' || record.type === 'gap') && (
        <>
          <Field label="Statement" value={r.statement} large />
          <Field label="Type" value={r.type} />
          <Field label="Workstream" value={r.workstream} />
          <Field label="Status" value={r.status} />
          <Field label="Risk If Wrong" value={r.risk_if_wrong} large />
          <Field label="Resolution Plan" value={r.resolution_plan} />
          <Field label="Owner" value={r.owner} />
          {r.linked_finding_ids?.length > 0 && (
            <Field label="Linked Findings" value={r.linked_finding_ids.join(', ')} mono />
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, large, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-xs leading-snug text-gray-800 ${large ? 'whitespace-pre-wrap' : ''} ${mono ? 'font-mono text-hbird-600' : ''}`}>
        {value}
      </p>
    </div>
  );
}
