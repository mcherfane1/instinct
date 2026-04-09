import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  PlusIcon,
  BriefcaseIcon,
  CalendarIcon,
  UserGroupIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import { engagementApi } from '../api/client';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';

export default function EngagementList() {
  const navigate = useNavigate();

  const [engagements, setEngagements] = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState(null);

  // "Create new" modal state
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState({ client_name: '', engagement_name: '', start_date: '' });
  const [isCreating,   setIsCreating]   = useState(false);
  const [createError,  setCreateError]  = useState(null);

  // Load engagements on mount
  useEffect(() => {
    load();
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await engagementApi.list();
      setEngagements(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.client_name.trim() || !createForm.engagement_name.trim()) {
      setCreateError('Client name and engagement name are required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await engagementApi.create(createForm);
      const created = res.data;
      setShowCreate(false);
      setCreateForm({ client_name: '', engagement_name: '', start_date: '' });
      // Navigate directly into the setup wizard for the new engagement
      navigate(`/engagements/${created.engagement_id}/setup`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  }

  function fmtDate(iso) {
    try { return format(parseISO(iso), 'MMM d, yyyy'); }
    catch { return iso || '—'; }
  }

  const active   = engagements.filter(e => e.status === 'Active');
  const archived = engagements.filter(e => e.status !== 'Active');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-hbird-950 border-b border-hbird-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-hbird-600">
              <span className="text-white text-sm font-bold">HI</span>
            </div>
            <div>
              <span className="text-white font-semibold text-sm">Hummingbird Instinct</span>
              <span className="text-hbird-400 text-xs ml-2">Engagement Knowledge Management</span>
            </div>
          </div>
          <Button
            icon={PlusIcon}
            onClick={() => setShowCreate(true)}
            size="sm"
          >
            New Engagement
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Engagements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Select an engagement to continue working, or create a new one.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load engagements</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && !error && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && engagements.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <EmptyState
              icon={BriefcaseIcon}
              title="No engagements yet"
              description="Create your first engagement to start capturing knowledge from client interviews, artifacts, and discoveries."
              action={
                <Button icon={PlusIcon} onClick={() => setShowCreate(true)}>
                  Create New Engagement
                </Button>
              }
            />
          </div>
        )}

        {/* Active engagements */}
        {!isLoading && active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Active ({active.length})
            </h2>
            <div className="grid gap-3">
              {active.map(e => (
                <EngagementCard key={e.engagement_id} engagement={e} onClick={() => navigate(`/engagements/${e.engagement_id}`)} fmtDate={fmtDate} />
              ))}
            </div>
          </section>
        )}

        {/* Archived / Closed engagements */}
        {!isLoading && archived.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Closed / Archived ({archived.length})
            </h2>
            <div className="grid gap-3">
              {archived.map(e => (
                <EngagementCard key={e.engagement_id} engagement={e} onClick={() => navigate(`/engagements/${e.engagement_id}`)} fmtDate={fmtDate} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create engagement modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null); }} title="New Engagement">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              placeholder="e.g. Regional Health System"
              value={createForm.client_name}
              onChange={e => setCreateForm(f => ({ ...f, client_name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Engagement Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              placeholder="e.g. Contact Center Assessment 2026"
              value={createForm.engagement_name}
              onChange={e => setCreateForm(f => ({ ...f, engagement_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
              value={createForm.start_date}
              onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))}
            />
          </div>

          {createError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
              {createError}
            </p>
          )}

          <p className="text-xs text-gray-500">
            You'll be taken to the Engagement Setup wizard to connect SharePoint, configure Core Config, and seed the Q&A tracker.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateError(null); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isCreating} icon={PlusIcon}>
              Create & Set Up
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EngagementCard({ engagement: e, onClick, fmtDate }) {
  const teamCount = Array.isArray(e.team_members) ? e.team_members.length : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:border-hbird-300 hover:shadow-md transition-all duration-150 group"
    >
      <div className="px-6 py-4 flex items-center gap-4">
        {/* Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-hbird-50 shrink-0">
          <BriefcaseIcon className="h-5 w-5 text-hbird-600" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {e.engagement_name}
            </span>
            <StatusBadge status={e.status} />
            {e.sow_review_status === 'SOW Not Reviewed' && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">SOW pending</span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{e.client_name}</p>
        </div>

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-gray-400 shrink-0">
          {e.start_date && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {fmtDate(e.start_date)}
            </span>
          )}
          {teamCount > 0 && (
            <span className="flex items-center gap-1">
              <UserGroupIcon className="h-3.5 w-3.5" />
              {teamCount} member{teamCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-gray-300">Created {fmtDate(e.created_at)}</span>
        </div>

        <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-hbird-500 transition-colors shrink-0" />
      </div>
    </button>
  );
}
