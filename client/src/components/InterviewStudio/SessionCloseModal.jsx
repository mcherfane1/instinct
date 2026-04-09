/**
 * SessionCloseModal — close a session with optional AI Metadata Review.
 *
 * Flow (PRD §7.1.6):
 * 1. User clicks "Close Session"
 * 2. Modal opens showing what will happen
 * 3. If AI is available: triggers POST /ai/session-review
 *    → Returns metadata suggestions for Engagement Lead review
 * 4. User reviews suggestions (approve / deny each one)
 * 5. Clicks "Close & Finish" → session marked Closed
 */
import React, { useEffect, useState } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { aiApi, metadataApi, sessionApi } from '../../api/client';
import Modal  from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

export default function SessionCloseModal({ engagementId, session, onDone, onCancel }) {
  const [aiAvailable, setAiAvailable] = useState(null);
  const [aiRunning, setAiRunning]     = useState(false);
  const [aiDone, setAiDone]           = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [aiError, setAiError]         = useState(null);
  const [closing, setClosing]         = useState(false);

  useEffect(() => {
    aiApi.status().then(res => setAiAvailable(res.data.available)).catch(() => setAiAvailable(false));
  }, []);

  async function runAiReview() {
    setAiRunning(true);
    setAiError(null);
    try {
      const res = await aiApi.sessionReview(engagementId, {
        session_id: session.session_id,
        canvas_text: session.canvas_text || '',
      });
      setSuggestions(res.data.suggestions || []);
      setAiDone(true);
    } catch (err) {
      setAiError(err.message || 'AI review failed. You can still close the session.');
      setAiDone(true);
    } finally {
      setAiRunning(false);
    }
  }

  async function approveSuggestion(sId) {
    try {
      await metadataApi.approve(engagementId, sId);
      setSuggestions(s => s.map(sg => sg.suggestion_id === sId ? { ...sg, status: 'Approved' } : sg));
    } catch {}
  }

  async function denySuggestion(sId) {
    try {
      await metadataApi.deny(engagementId, sId);
      setSuggestions(s => s.map(sg => sg.suggestion_id === sId ? { ...sg, status: 'Denied' } : sg));
    } catch {}
  }

  async function handleClose() {
    setClosing(true);
    try {
      await sessionApi.close(engagementId, session.session_id);
      onDone();
    } catch (err) {
      setClosing(false);
    }
  }

  const pendingSuggestions = suggestions.filter(s => s.status === 'Pending');

  return (
    <Modal open onClose={onCancel} title="Close Interview Session" size="lg">
      <div className="space-y-5">

        {/* Session summary */}
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <InformationCircleIcon className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-800">{session.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Closing this session will mark it read-only. Canvas content is preserved.
              Any findings or questions promoted during the session remain in the knowledge base.
            </p>
          </div>
        </div>

        {/* AI Metadata Review section */}
        {aiAvailable === null ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : aiAvailable ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="h-4 w-4 text-hbird-500" />
              <span className="text-sm font-medium text-gray-900">AI Metadata Review</span>
            </div>

            {!aiDone && !aiRunning && (
              <div className="flex items-start gap-3 p-4 bg-hbird-50 rounded-lg border border-hbird-200">
                <p className="text-sm text-hbird-700 flex-1">
                  Run AI analysis of the session canvas to identify new workstreams, contact centers,
                  technologies, or stakeholders that aren't in the engagement's controlled vocabulary.
                </p>
                <Button size="sm" icon={SparklesIcon} onClick={runAiReview}>
                  Run Review
                </Button>
              </div>
            )}

            {aiRunning && (
              <div className="flex items-center gap-3 p-4 bg-hbird-50 rounded-lg border border-hbird-200">
                <Spinner size="sm" />
                <p className="text-sm text-hbird-700">Analysing session canvas…</p>
              </div>
            )}

            {aiError && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
                {aiError}
              </div>
            )}

            {aiDone && suggestions.length === 0 && !aiError && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-700">No new metadata suggestions — everything is already in the controlled vocabulary.</p>
              </div>
            )}

            {aiDone && suggestions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''} pending review.
                  Approved suggestions extend the engagement's controlled vocabulary.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {suggestions.map(sg => (
                    <SuggestionRow
                      key={sg.suggestion_id}
                      suggestion={sg}
                      onApprove={() => approveSuggestion(sg.suggestion_id)}
                      onDeny={() => denySuggestion(sg.suggestion_id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
            <ExclamationTriangleIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            AI features are not available (no API key configured). Session will close without metadata review.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={closing}>Cancel</Button>
          <Button
            icon={CheckCircleIcon}
            loading={closing}
            onClick={handleClose}
          >
            Close Session
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SuggestionRow({ suggestion: sg, onApprove, onDeny }) {
  const isPending  = sg.status === 'Pending';
  const isApproved = sg.status === 'Approved';
  const isDenied   = sg.status === 'Denied';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
      isApproved ? 'bg-green-50 border-green-200' :
      isDenied   ? 'bg-gray-50 border-gray-200 opacity-60' :
                   'bg-white border-gray-200'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {sg.suggestion_type?.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-400">
            {sg.ai_confidence ? `${Math.round(sg.ai_confidence * 100)}% confidence` : ''}
          </span>
        </div>
        <p className="text-gray-800 font-medium truncate">{sg.proposed_value}</p>
        {sg.existing_value && (
          <p className="text-xs text-gray-400 mt-0.5">Similar to: {sg.existing_value}</p>
        )}
      </div>

      {isPending ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onApprove}
            className="flex items-center gap-1 text-xs text-green-700 bg-green-100 hover:bg-green-200 px-2 py-1 rounded transition-colors">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Approve
          </button>
          <button onClick={onDeny}
            className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">
            <XCircleIcon className="h-3.5 w-3.5" />
            Deny
          </button>
        </div>
      ) : (
        <span className={`text-xs font-medium shrink-0 ${isApproved ? 'text-green-600' : 'text-gray-400'}`}>
          {sg.status}
        </span>
      )}
    </div>
  );
}
