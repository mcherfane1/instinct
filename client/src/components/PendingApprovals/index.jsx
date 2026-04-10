/**
 * Pending Approvals — PRD §6.2
 * Standalone page for Engagement Lead to review AI metadata suggestions.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { metadataApi } from '../../api/client';
import useEngagementStore from '../../store/engagementStore';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTION_TYPE_CFG = {
  'Add new workstream':       { label: 'New Workstream',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Add new technology':       { label: 'New Technology',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Add new state tag':        { label: 'New State Tag',        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'Add new contact center':   { label: 'New Contact Center',   cls: 'bg-green-50 text-green-700 border-green-200' },
  'Rename existing value':    { label: 'Rename Value',         cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Add new relationship type':{ label: 'New Relationship Type',cls: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const RECONFIRM_STATUS_CFG = {
  'Auto-Committed':       { label: 'Auto-committed',         cls: 'bg-green-50 text-green-700', icon: CheckCircleIcon },
  'Pending-Lead-Review':  { label: 'Needs your review',      cls: 'bg-amber-50 text-amber-700', icon: ExclamationTriangleIcon },
  'Unclassified':         { label: 'Unclassified — assign manually', cls: 'bg-red-50 text-red-700', icon: ExclamationCircleIcon },
};

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy h:mm a'); }
  catch { return iso; }
}

function confidenceBar(conf) {
  if (!conf && conf !== 0) return null;
  const pct   = Math.round(conf * 100);
  const color = conf >= 0.8 ? 'bg-green-400' : conf >= 0.5 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500">{pct}% confidence</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PendingApprovals() {
  const { currentEngagement, refreshStats } = useEngagementStore();
  const engagementId = currentEngagement?.engagement_id;

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [statusFilter, setStatusFilter] = useState('Pending');

  // Per-suggestion action state
  const [acting, setActing]           = useState({}); // { [id]: 'approving' | 'denying' | 'assigning' }
  const [actionResult, setActionResult] = useState({}); // { [id]: { ok, message, reconfirm } }
  const [assignValues, setAssignValues] = useState({}); // { [id]: string }

  const load = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== 'All' ? { status: statusFilter } : {};
      const res = await metadataApi.suggestions(engagementId, params);
      setSuggestions(res.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [engagementId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    setActing(a => ({ ...a, [id]: 'approving' }));
    try {
      await metadataApi.approve(engagementId, id);
      setActionResult(r => ({ ...r, [id]: { ok: true, action: 'approved' } }));
      refreshStats();
      // Refresh list after short delay so user sees the success state
      setTimeout(load, 800);
    } catch (e) {
      setActionResult(r => ({ ...r, [id]: { ok: false, message: e.message } }));
    } finally {
      setActing(a => ({ ...a, [id]: null }));
    }
  }

  async function handleDeny(id) {
    setActing(a => ({ ...a, [id]: 'denying' }));
    try {
      const res = await metadataApi.deny(engagementId, id);
      setActionResult(r => ({ ...r, [id]: {
        ok: true,
        action: 'denied',
        reconfirmStatus: res.data.reconfirmStatus,
        reconfirmValue:  res.data.reconfirmValue,
        reconfirmConf:   res.data.reconfirmConf,
      }}));
      refreshStats();
      setTimeout(load, 1200);
    } catch (e) {
      setActionResult(r => ({ ...r, [id]: { ok: false, message: e.message } }));
    } finally {
      setActing(a => ({ ...a, [id]: null }));
    }
  }

  async function handleAssign(id) {
    const val = (assignValues[id] || '').trim();
    if (!val) return;
    setActing(a => ({ ...a, [id]: 'assigning' }));
    try {
      await metadataApi.assign(engagementId, id, val);
      setActionResult(r => ({ ...r, [id]: { ok: true, action: 'assigned', assignedValue: val } }));
      refreshStats();
      setTimeout(load, 800);
    } catch (e) {
      setActionResult(r => ({ ...r, [id]: { ok: false, message: e.message } }));
    } finally {
      setActing(a => ({ ...a, [id]: null }));
    }
  }

  const pendingCount = suggestions.filter(s => s.status === 'Pending').length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pending Approvals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review AI-proposed changes to the engagement metadata schema.
          </p>
        </div>
        {pendingCount > 0 && statusFilter === 'Pending' && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <BellAlertIcon className="h-4 w-4" />
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Role note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
        <InformationCircleIcon className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Only the Engagement Lead can approve or deny metadata suggestions.
          Approved suggestions update the controlled vocabulary and re-tag all affected records.
          Denied suggestions trigger an AI re-conforming pass.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {['Pending', 'Approved', 'Denied', 'All'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-hbird-600 text-white border-hbird-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-hbird-300 hover:text-hbird-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && suggestions.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {statusFilter === 'Pending' ? 'All caught up' : `No ${statusFilter.toLowerCase()} suggestions`}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {statusFilter === 'Pending'
              ? 'No metadata suggestions are waiting for review. They appear here after artifact ingestion or session close.'
              : 'Switch to Pending to see items awaiting review.'}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-4">
          {suggestions.map(s => (
            <SuggestionCard
              key={s.suggestion_id}
              suggestion={s}
              acting={acting[s.suggestion_id]}
              actionResult={actionResult[s.suggestion_id]}
              assignValue={assignValues[s.suggestion_id] || ''}
              onAssignChange={v => setAssignValues(a => ({ ...a, [s.suggestion_id]: v }))}
              onApprove={() => handleApprove(s.suggestion_id)}
              onDeny={()    => handleDeny(s.suggestion_id)}
              onAssign={()  => handleAssign(s.suggestion_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Suggestion card ─────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion: s,
  acting,
  actionResult,
  assignValue,
  onAssignChange,
  onApprove,
  onDeny,
  onAssign,
}) {
  const typeCfg = SUGGESTION_TYPE_CFG[s.suggestion_type] || {
    label: s.suggestion_type, cls: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const isPending  = s.status === 'Pending';
  const isDenied   = s.status === 'Denied';
  const isApproved = s.status === 'Approved';

  const result = actionResult;
  const reconfirmCfg = s.reconfirm_status ? RECONFIRM_STATUS_CFG[s.reconfirm_status] : null;
  const needsManualAssign = isDenied && s.reconfirm_status === 'Unclassified';
  const needsLeadReview   = isDenied && s.reconfirm_status === 'Pending-Lead-Review';

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      isApproved ? 'border-green-200' : isDenied ? 'border-gray-200' : 'border-gray-200'
    }`}>

      {/* Top bar */}
      <div className={`px-5 py-3 border-b flex items-center gap-3 ${
        isApproved ? 'bg-green-50 border-green-100'
        : isDenied  ? 'bg-gray-50 border-gray-100'
        : 'bg-white border-gray-100'
      }`}>
        {/* Type badge */}
        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${typeCfg.cls}`}>
          {typeCfg.label}
        </span>
        <span className="font-mono text-[10px] text-gray-400">{s.suggestion_id}</span>

        {/* Status badge */}
        {isApproved && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Approved
          </span>
        )}
        {isDenied && (
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-500 font-medium">
            <XCircleIcon className="h-3.5 w-3.5" /> Denied
          </span>
        )}
        {s.created_at && (
          <span className={`text-[10px] text-gray-400 ${isPending ? 'ml-auto' : ''}`}>
            {fmtDate(s.created_at)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">

        {/* Core proposal */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Proposed value</p>
          <p className="text-sm font-semibold text-gray-900">{s.proposed_value}</p>
          {s.existing_value && (
            <p className="text-xs text-gray-500 mt-0.5">
              Renames: <span className="line-through">{s.existing_value}</span> → {s.proposed_value}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Scope: {s.scope}</p>
        </div>

        {/* AI confidence */}
        {(s.ai_confidence !== null && s.ai_confidence !== undefined) && (
          <div>{confidenceBar(s.ai_confidence)}</div>
        )}

        {/* Example text that triggered this */}
        {s.example_text && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Triggering text</p>
            <p className="text-xs text-gray-600 italic leading-relaxed">"{s.example_text}"</p>
          </div>
        )}

        {/* Affected records */}
        {s.affected_record_ids?.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Affected records ({s.affected_record_ids.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {s.affected_record_ids.map(id => (
                <span key={id} className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {s.trigger_source_id && (
          <p className="text-[10px] text-gray-400">
            Source: <span className="font-mono">{s.trigger_source_id}</span>
            {s.trigger_source_type && ` (${s.trigger_source_type})`}
          </p>
        )}

        {/* Deny-and-reconfirm result — shown after denial */}
        {isDenied && reconfirmCfg && (
          <div className={`rounded-lg px-3 py-2 border ${
            s.reconfirm_status === 'Auto-Committed' ? 'bg-green-50 border-green-200'
            : s.reconfirm_status === 'Pending-Lead-Review' ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <reconfirmCfg.icon className="h-3.5 w-3.5 shrink-0" />
              <span className={`text-xs font-medium ${reconfirmCfg.cls.split(' ')[1]}`}>
                {reconfirmCfg.label}
              </span>
            </div>
            {s.reconfirm_value && (
              <p className="text-xs text-gray-600">
                Re-mapped to: <span className="font-semibold">{s.reconfirm_value}</span>
                {s.reconfirm_confidence !== null && (
                  <span className="text-gray-400 ml-1">
                    ({Math.round((s.reconfirm_confidence || 0) * 100)}% confidence)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Manual assign — Unclassified or Pending-Lead-Review */}
        {isDenied && (needsManualAssign || needsLeadReview) && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">
              {needsManualAssign
                ? 'AI could not re-map these records. Assign manually:'
                : 'Confirm or override the AI re-mapping:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                placeholder={needsLeadReview ? s.reconfirm_value || 'Assign value…' : 'Assign value…'}
                value={assignValue}
                onChange={e => onAssignChange(e.target.value)}
              />
              <Button
                size="sm"
                onClick={onAssign}
                loading={acting === 'assigning'}
                disabled={!assignValue.trim()}
              >
                Assign
              </Button>
            </div>
          </div>
        )}

        {/* Instant action result */}
        {result && !result.ok && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <ExclamationCircleIcon className="h-3.5 w-3.5 shrink-0" />
            {result.message}
          </div>
        )}

        {/* Approve / Deny buttons — Pending only */}
        {isPending && !result && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onApprove}
              disabled={!!acting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium
                bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {acting === 'approving'
                ? <Spinner size="sm" className="text-white" />
                : <CheckCircleIcon className="h-4 w-4" />
              }
              Approve
            </button>
            <button
              onClick={onDeny}
              disabled={!!acting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium
                bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {acting === 'denying'
                ? <Spinner size="sm" />
                : <XCircleIcon className="h-4 w-4 text-red-400" />
              }
              Deny
            </button>
          </div>
        )}

        {/* Review metadata */}
        {s.reviewed_at && (
          <p className="text-[10px] text-gray-400">
            Reviewed {fmtDate(s.reviewed_at)}{s.reviewed_by ? ` by ${s.reviewed_by}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
