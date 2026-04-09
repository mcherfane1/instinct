/**
 * Left context panel for a session.
 * Shows: Participants, Workstream/Contact Center selectors, Open Questions list.
 */
import React, { useEffect, useState } from 'react';
import {
  UserGroupIcon,
  TagIcon,
  QuestionMarkCircleIcon,
  PlusIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import useEngagementStore from '../../store/engagementStore';
import { questionApi }    from '../../api/client';

export default function SessionContextPanel({ engagementId, session, onSessionUpdate }) {
  const { currentEngagement } = useEngagementStore();
  const [questions, setQuestions]         = useState([]);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [participant, setParticipant]     = useState('');

  const wsOptions = currentEngagement?.workstreams     ? JSON.parse(currentEngagement.workstreams)     : [];
  const ccOptions = currentEngagement?.contact_centers ? JSON.parse(currentEngagement.contact_centers) : [];

  useEffect(() => {
    questionApi.list(engagementId, { status: 'Open' })
      .then(res => setQuestions(res.data || []))
      .catch(() => {});
  }, [engagementId]);

  const participants = Array.isArray(session.participants) ? session.participants : [];

  function addParticipant(e) {
    e.preventDefault();
    if (!participant.trim()) return;
    const updated = [...participants, participant.trim()];
    setParticipant('');
    onSessionUpdate({ participants: updated });
  }

  function removeParticipant(name) {
    const updated = participants.filter(p => p !== name);
    onSessionUpdate({ participants: updated });
  }

  const isClosed = session.status === 'Closed';

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">

      {/* Participants */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <UserGroupIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Participants</span>
        </div>

        <div className="space-y-1 mb-2">
          {participants.map(p => (
            <div key={p} className="flex items-center gap-1 group">
              <span className="text-xs text-gray-700 flex-1 truncate">{p}</span>
              {!isClosed && (
                <button onClick={() => removeParticipant(p)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {participants.length === 0 && (
            <p className="text-xs text-gray-400 italic">No participants yet</p>
          )}
        </div>

        {!isClosed && (
          <form onSubmit={addParticipant} className="flex gap-1">
            <input
              type="text"
              className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-hbird-400"
              placeholder="Add name..."
              value={participant}
              onChange={e => setParticipant(e.target.value)}
            />
            <button type="submit"
              className="text-hbird-500 hover:text-hbird-700 p-1">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </section>

      {/* Context tags */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <TagIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</span>
        </div>

        {/* Workstream */}
        <div className="mb-2">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 block">Workstream</label>
          {wsOptions.length > 0 ? (
            <select
              disabled={isClosed}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              value={session.workstream || ''}
              onChange={e => onSessionUpdate({ workstream: e.target.value || null })}
            >
              <option value="">— None —</option>
              {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
            </select>
          ) : (
            <p className="text-xs text-gray-400 italic">No workstreams defined</p>
          )}
        </div>

        {/* Contact center */}
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5 block">Contact Center</label>
          {ccOptions.length > 0 ? (
            <select
              disabled={isClosed}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              value={session.contact_center || ''}
              onChange={e => onSessionUpdate({ contact_center: e.target.value || null })}
            >
              <option value="">— None —</option>
              {ccOptions.map(cc => <option key={cc} value={cc}>{cc}</option>)}
            </select>
          ) : (
            <p className="text-xs text-gray-400 italic">No contact centers defined</p>
          )}
        </div>
      </section>

      {/* Open questions */}
      <section className="px-3 py-3 flex-1 min-h-0">
        <button
          className="flex items-center gap-1.5 mb-2 w-full group"
          onClick={() => setQuestionsOpen(o => !o)}
        >
          <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1 text-left">
            Open Questions
          </span>
          <span className="text-xs text-gray-400">{questions.length}</span>
          <ChevronDownIcon className={`h-3 w-3 text-gray-400 transition-transform ${questionsOpen ? '' : '-rotate-90'}`} />
        </button>

        {questionsOpen && (
          <div className="space-y-2">
            {questions.length === 0 && (
              <p className="text-xs text-gray-400 italic">No open questions</p>
            )}
            {questions.map(q => (
              <div key={q.question_id} className="text-xs">
                <p className="text-[10px] font-mono text-hbird-400 mb-0.5">{q.question_id}</p>
                <p className="text-gray-600 leading-snug line-clamp-3">{q.question_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
