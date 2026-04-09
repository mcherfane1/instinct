import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  UserGroupIcon,
  ClockIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';

import useEngagementStore from '../../store/engagementStore';
import useSessionStore    from '../../store/sessionStore';
import { sessionApi }     from '../../api/client';
import Button             from '../common/Button';
import Modal              from '../common/Modal';
import Spinner            from '../common/Spinner';
import EmptyState         from '../common/EmptyState';
import SessionView        from './SessionView';

export default function InterviewStudio() {
  const { engagementId, sessionId } = useParams();

  // If a session is open, render the session view
  if (sessionId) {
    return <SessionView engagementId={engagementId} sessionId={sessionId} />;
  }

  return <SessionList engagementId={engagementId} />;
}

// ---------------------------------------------------------------------------
// Session list
// ---------------------------------------------------------------------------

function SessionList({ engagementId }) {
  const navigate               = useNavigate();
  const { currentEngagement }  = useEngagementStore();
  const { sessions, loadSessions } = useSessionStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // Create session modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ name: '', date: today(), participants: '', workstream: '', contact_center: '' });
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try { await loadSessions(engagementId); }
      catch (err) { setError(err.message); }
      finally { setIsLoading(false); }
    }
    load();
  }, [engagementId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.date) {
      setCreateError('Session name and date are required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await sessionApi.create(engagementId, {
        name:           form.name.trim(),
        date:           form.date,
        participants:   form.participants.split(',').map(p => p.trim()).filter(Boolean),
        workstream:     form.workstream || null,
        contact_center: form.contact_center || null,
      });
      const created = res.data;
      setShowCreate(false);
      navigate(`/engagements/${engagementId}/interview/${created.session_id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const config    = currentEngagement;
  const wsOptions = config?.workstreams     ? JSON.parse(config.workstreams)     : [];
  const ccOptions = config?.contact_centers ? JSON.parse(config.contact_centers) : [];

  const active   = sessions.filter(s => s.status === 'Active');
  const closed   = sessions.filter(s => s.status === 'Closed');

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Interview Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Capture live interview notes with real-time knowledge extraction.
          </p>
        </div>
        <Button icon={PlusIcon} onClick={() => setShowCreate(true)}>New Session</Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={ChatBubbleLeftRightIcon}
            title="No sessions yet"
            description="Create your first interview session to start capturing notes and extracting knowledge."
            action={<Button icon={PlusIcon} onClick={() => setShowCreate(true)}>Create Session</Button>}
          />
        </div>
      )}

      {/* Active sessions */}
      {!isLoading && active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Active ({active.length})
          </h2>
          <div className="grid gap-3">
            {active.map(s => (
              <SessionCard key={s.session_id} session={s}
                onClick={() => navigate(`/engagements/${engagementId}/interview/${s.session_id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Closed sessions */}
      {!isLoading && closed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Closed ({closed.length})
          </h2>
          <div className="grid gap-3">
            {closed.map(s => (
              <SessionCard key={s.session_id} session={s}
                onClick={() => navigate(`/engagements/${engagementId}/interview/${s.session_id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Create session modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null); }} title="New Interview Session">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Name <span className="text-red-500">*</span></label>
            <input type="text" autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              placeholder="e.g. Contact Center SME Interview – Wave 1"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
            <input type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
            <input type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              placeholder="Comma-separated names"
              value={form.participants}
              onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workstream</label>
              {wsOptions.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                  value={form.workstream}
                  onChange={e => setForm(f => ({ ...f, workstream: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
                </select>
              ) : (
                <input type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                  placeholder="e.g. Technology"
                  value={form.workstream}
                  onChange={e => setForm(f => ({ ...f, workstream: e.target.value }))}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Center</label>
              {ccOptions.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                  value={form.contact_center}
                  onChange={e => setForm(f => ({ ...f, contact_center: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {ccOptions.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              ) : (
                <input type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                  placeholder="e.g. Main Campus"
                  value={form.contact_center}
                  onChange={e => setForm(f => ({ ...f, contact_center: e.target.value }))}
                />
              )}
            </div>
          </div>

          {createError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
              {createError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancel</Button>
            <Button type="submit" icon={PlusIcon} loading={creating}>Start Session</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SessionCard({ session: s, onClick }) {
  const tc = Array.isArray(s.participants) ? s.participants.length : 0;
  const elapsed = s.elapsed_seconds ? formatElapsed(s.elapsed_seconds) : null;

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:border-hbird-300 hover:shadow-md transition-all duration-150 group"
    >
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-hbird-50 shrink-0">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-hbird-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{s.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              s.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>{s.status}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {s.date && <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{fmtDate(s.date)}</span>}
            {tc > 0 && <span className="flex items-center gap-1"><UserGroupIcon className="h-3.5 w-3.5" />{tc} participant{tc !== 1 ? 's' : ''}</span>}
            {elapsed && <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{elapsed}</span>}
            {s.workstream && <span className="text-hbird-500">{s.workstream}</span>}
          </div>
        </div>
        <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-hbird-500 transition-colors shrink-0" />
      </div>
    </button>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy'); }
  catch { return iso; }
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
