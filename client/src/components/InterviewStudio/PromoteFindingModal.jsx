/**
 * PromoteFindingModal — promote selected canvas text to a structured record.
 *
 * Supports promoting to: Finding, Question, Action, Decision.
 * The "type" is pre-filled based on the inline prefix or bubble menu selection.
 */
import React, { useState } from 'react';
import { ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import useEngagementStore from '../../store/engagementStore';
import { findingApi, questionApi, decisionApi } from '../../api/client';
import Modal  from '../common/Modal';
import Button from '../common/Button';

const TYPE_OPTIONS  = ['Finding', 'Question', 'Action', 'Decision'];
const STATE_TAGS     = ['Current State', 'Future State', 'Gap', 'Recommendation', 'Decision', 'Risk', 'Assumption'];
const RELATIONSHIPS  = ['Decision', 'Action']; // for decisions_actions

export default function PromoteFindingModal({ engagementId, session, initialText, initialType, onClose }) {
  const { currentEngagement, refreshStats } = useEngagementStore();

  const [type, setType]     = useState(initialType || 'Finding');
  const [text, setText]     = useState(initialText || '');
  const [stateTag, setStateTag] = useState('');
  const [workstream, setWorkstream] = useState(session.workstream || '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  const wsOptions = currentEngagement?.workstreams ? JSON.parse(currentEngagement.workstreams) : [];

  async function handlePromote() {
    if (!text.trim()) { setError('Text is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (type === 'Finding') {
        await findingApi.create(engagementId, {
          finding_text: text.trim(),
          state_tag:    stateTag || null,
          workstream:   workstream || null,
          source_type:  'Interview',
          source_session_id: session.session_id,
        });
        setSuccess('Finding created.');
      } else if (type === 'Question') {
        await questionApi.create(engagementId, {
          question_text:     text.trim(),
          section:           workstream || null,
          source_session_id: session.session_id,
        });
        setSuccess('Question added to Q tracker.');
      } else if (type === 'Action' || type === 'Decision') {
        await decisionApi.create(engagementId, {
          type,
          description:       text.trim(),
          workstream:        workstream || null,
          source_session_id: session.session_id,
        });
        setSuccess(`${type} created.`);
      }
      await refreshStats();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Promote to ${type}`} size="md">
      <div className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Record Type</label>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map(t => (
              <button key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  type === t
                    ? 'bg-hbird-600 text-white border-hbird-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-hbird-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent resize-none"
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>

        {/* State tag — findings only */}
        {type === 'Finding' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State Tag</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
              value={stateTag}
              onChange={e => setStateTag(e.target.value)}
            >
              <option value="">— Not specified —</option>
              {STATE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {/* Workstream */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Workstream</label>
          {wsOptions.length > 0 ? (
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
              value={workstream}
              onChange={e => setWorkstream(e.target.value)}
            >
              <option value="">— None —</option>
              {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
            </select>
          ) : (
            <input type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
              placeholder="e.g. Technology"
              value={workstream}
              onChange={e => setWorkstream(e.target.value)}
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            {success}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePromote} loading={saving}>
            Promote as {type}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
