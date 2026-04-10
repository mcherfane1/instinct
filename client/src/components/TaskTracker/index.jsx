/**
 * Engagement Task Tracker — PRD §7.4, §5.7, §5.8
 * Tabs: Decisions | Actions | Assumptions | Gaps
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  BoltIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  PlusIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { assumptionApi, decisionApi } from '../../api/client';
import useEngagementStore from '../../store/engagementStore';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = ['Decisions', 'Actions', 'Assumptions', 'Gaps'];

const ACTION_STATUSES   = ['Open', 'In Progress', 'Complete', 'Cancelled'];
const DECISION_STATUSES = ['Open', 'In Progress', 'Complete', 'Cancelled'];
const ASM_STATUSES      = ['Open', 'In Progress', 'Resolved', 'Accepted Risk'];

const STATUS_CLS = {
  'Open':          'bg-yellow-50 text-yellow-700',
  'In Progress':   'bg-blue-50 text-blue-700',
  'Complete':      'bg-green-50 text-green-700',
  'Cancelled':     'bg-gray-100 text-gray-500',
  'Resolved':      'bg-green-50 text-green-700',
  'Accepted Risk': 'bg-orange-50 text-orange-700',
};

function fmtDate(iso) {
  if (!iso) return null;
  try { return format(parseISO(iso.slice(0, 10)), 'MMM d, yyyy'); }
  catch { return iso; }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TaskTracker() {
  const { currentEngagement } = useEngagementStore();
  const engagementId = currentEngagement?.engagement_id;

  const [tab, setTab] = useState('Decisions');

  const wsOptions = currentEngagement?.workstreams
    ? JSON.parse(currentEngagement.workstreams) : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Engagement Task Tracker</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track decisions, actions, assumptions, and gaps across the engagement.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-hbird-600 text-hbird-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Decisions'  && <DecisionsTab engagementId={engagementId} wsOptions={wsOptions} />}
      {tab === 'Actions'    && <ActionsTab   engagementId={engagementId} wsOptions={wsOptions} />}
      {tab === 'Assumptions'&& <AsmGapTab    engagementId={engagementId} wsOptions={wsOptions} type="Assumption" />}
      {tab === 'Gaps'       && <AsmGapTab    engagementId={engagementId} wsOptions={wsOptions} type="Gap" />}
    </div>
  );
}

// ─── Decisions tab ────────────────────────────────────────────────────────────

function DecisionsTab({ engagementId, wsOptions }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filters, setFilters] = useState({ status: '', owner: '', workstream: '' });

  // Create modal
  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState({ description: '', workstream: '', owner: '' });
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);

  // Supersede modal
  const [superseding, setSuperseding] = useState(null); // item being superseded
  const [newDesc, setNewDesc]         = useState('');
  const [newOwner, setNewOwner]       = useState('');
  const [supersedeError, setSupersedeError] = useState(null);
  const [supersedeLoading, setSupersedeLoading] = useState(false);

  const load = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const res = await decisionApi.list(engagementId, { type: 'Decision', ...filterParams(filters) });
      setItems(res.data || []);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [engagementId, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.description.trim()) { setCreateError('Description is required.'); return; }
    setCreating(true); setCreateError(null);
    try {
      await decisionApi.create(engagementId, { type: 'Decision', ...form });
      setShowCreate(false);
      setForm({ description: '', workstream: '', owner: '' });
      load();
    } catch (e) { setCreateError(e.message); }
    finally { setCreating(false); }
  }

  async function handleConfirm(id) {
    try { await decisionApi.confirm(engagementId, id); load(); }
    catch (e) { console.error(e.message); }
  }

  async function handleStatusChange(id, status) {
    try { await decisionApi.update(engagementId, id, { status }); load(); }
    catch (e) { console.error(e.message); }
  }

  async function handleSupersede(e) {
    e.preventDefault();
    if (!newDesc.trim()) { setSupersedeError('Description is required.'); return; }
    setSupersedeLoading(true); setSupersedeError(null);
    try {
      // 1. Mark old as superseded
      await decisionApi.update(engagementId, superseding.item_id, { is_superseded: 1 });
      // 2. Create the new superseding decision
      const res = await decisionApi.create(engagementId, {
        type: 'Decision',
        description: newDesc.trim(),
        workstream:  superseding.workstream || '',
        owner:       newOwner.trim() || superseding.owner || '',
      });
      // 3. Link superseded_by on old record
      await decisionApi.update(engagementId, superseding.item_id, { superseded_by: res.data.item_id });
      setSuperseding(null); setNewDesc(''); setNewOwner('');
      load();
    } catch (e) { setSupersedeError(e.message); }
    finally { setSupersedeLoading(false); }
  }

  const visible = items.filter(i =>
    (!filters.workstream || i.workstream === filters.workstream) &&
    (!filters.owner || (i.owner || '').toLowerCase().includes(filters.owner.toLowerCase()))
  );

  return (
    <>
      <FilterBar
        filters={filters} setFilters={setFilters}
        wsOptions={wsOptions} statusOptions={DECISION_STATUSES}
        onAdd={() => setShowCreate(true)}
        addLabel="New Decision"
      />

      {error && <ErrorBanner message={error} />}
      {loading && <SpinnerBlock />}

      {!loading && visible.length === 0 && (
        <EmptyState
          icon={ClipboardDocumentListIcon}
          title="No decisions yet"
          description="Log confirmed decisions to build an immutable record of what was decided and when."
          action={<Button icon={PlusIcon} onClick={() => setShowCreate(true)}>New Decision</Button>}
        />
      )}

      {!loading && (
        <div className="space-y-3">
          {visible.map(item => (
            <DecisionCard
              key={item.item_id}
              item={item}
              onConfirm={() => handleConfirm(item.item_id)}
              onStatusChange={(s) => handleStatusChange(item.item_id, s)}
              onSupersede={() => { setSuperseding(item); setNewOwner(item.owner || ''); }}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null); }} title="New Decision">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Description *">
            <textarea
              autoFocus rows={3}
              className={TEXTAREA_CLS}
              placeholder="What was decided?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <input type="text" className={INPUT_CLS} placeholder="Name"
                value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            </Field>
            <Field label="Workstream">
              <WsSelect wsOptions={wsOptions} value={form.workstream}
                onChange={v => setForm(f => ({ ...f, workstream: v }))} />
            </Field>
          </div>
          {createError && <InlineError message={createError} />}
          <ModalActions onCancel={() => { setShowCreate(false); setCreateError(null); }}
            loading={creating} submitLabel="Create Decision" />
        </form>
      </Modal>

      {/* Supersede modal */}
      <Modal open={!!superseding} onClose={() => { setSuperseding(null); setSupersedeError(null); }} title="Supersede Decision">
        {superseding && (
          <form onSubmit={handleSupersede} className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600">
              <span className="font-mono text-hbird-500 text-xs mr-2">{superseding.item_id}</span>
              {superseding.description}
            </div>
            <Field label="New decision text *">
              <textarea rows={3} autoFocus className={TEXTAREA_CLS}
                placeholder="What supersedes this decision?"
                value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </Field>
            <Field label="Owner">
              <input type="text" className={INPUT_CLS} value={newOwner}
                onChange={e => setNewOwner(e.target.value)} />
            </Field>
            {supersedeError && <InlineError message={supersedeError} />}
            <ModalActions onCancel={() => { setSuperseding(null); setSupersedeError(null); }}
              loading={supersedeLoading} submitLabel="Create Superseding Decision" />
          </form>
        )}
      </Modal>
    </>
  );
}

function DecisionCard({ item, onConfirm, onStatusChange, onSupersede }) {
  const isConfirmed  = !!item.confirmed_date;
  const isSuperseded = !!item.is_superseded;

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      isSuperseded ? 'border-gray-200 opacity-60' : 'border-gray-200'
    }`}>
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-hbird-400">{item.item_id}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[item.status] || ''}`}>
                {item.status}
              </span>
              {isConfirmed && (
                <span className="flex items-center gap-0.5 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                  <LockClosedIcon className="h-3 w-3" /> Confirmed {fmtDate(item.confirmed_date)}
                </span>
              )}
              {isSuperseded && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  Superseded {item.superseded_by && `→ ${item.superseded_by}`}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 leading-snug">{item.description}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
              {item.owner && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{item.owner}</span>}
              {item.workstream && <span>{item.workstream}</span>}
            </div>
          </div>

          {/* Actions */}
          {!isConfirmed && !isSuperseded && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Status cycle */}
              {item.status !== 'Complete' && item.status !== 'Cancelled' && (
                <select
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
                  value={item.status}
                  onChange={e => onStatusChange(e.target.value)}
                >
                  {DECISION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button
                onClick={onConfirm}
                title="Confirm — makes this decision immutable"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
              >
                <CheckCircleIcon className="h-3.5 w-3.5" /> Confirm
              </button>
              <button
                onClick={onSupersede}
                title="Supersede this decision"
                className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                Supersede
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Actions tab ──────────────────────────────────────────────────────────────

function ActionsTab({ engagementId, wsOptions }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filters, setFilters] = useState({ status: '', owner: '', workstream: '' });

  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState({ description: '', workstream: '', owner: '', due_date: '' });
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);

  const load = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const res = await decisionApi.list(engagementId, { type: 'Action', ...filterParams(filters) });
      setItems(res.data || []);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [engagementId, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.description.trim()) { setCreateError('Description is required.'); return; }
    setCreating(true); setCreateError(null);
    try {
      await decisionApi.create(engagementId, { type: 'Action', ...form });
      setShowCreate(false);
      setForm({ description: '', workstream: '', owner: '', due_date: '' });
      load();
    } catch (e) { setCreateError(e.message); }
    finally { setCreating(false); }
  }

  async function handleStatusChange(id, status) {
    try { await decisionApi.update(engagementId, id, { status }); load(); }
    catch (e) { console.error(e.message); }
  }

  const visible = items.filter(i =>
    (!filters.workstream || i.workstream === filters.workstream) &&
    (!filters.owner || (i.owner || '').toLowerCase().includes(filters.owner.toLowerCase()))
  );

  return (
    <>
      <FilterBar filters={filters} setFilters={setFilters} wsOptions={wsOptions}
        statusOptions={ACTION_STATUSES} onAdd={() => setShowCreate(true)} addLabel="New Action" />
      {error && <ErrorBanner message={error} />}
      {loading && <SpinnerBlock />}

      {!loading && visible.length === 0 && (
        <EmptyState
          icon={BoltIcon}
          title="No actions yet"
          description="Log action items with owners and due dates to keep the engagement on track."
          action={<Button icon={PlusIcon} onClick={() => setShowCreate(true)}>New Action</Button>}
        />
      )}

      {!loading && (
        <div className="space-y-3">
          {visible.map(item => (
            <ActionCard key={item.item_id} item={item}
              onStatusChange={(s) => handleStatusChange(item.item_id, s)} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null); }} title="New Action">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Description *">
            <textarea autoFocus rows={3} className={TEXTAREA_CLS}
              placeholder="What needs to be done?"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <input type="text" className={INPUT_CLS} placeholder="Name"
                value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <input type="date" className={INPUT_CLS}
                value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
          </div>
          <Field label="Workstream">
            <WsSelect wsOptions={wsOptions} value={form.workstream}
              onChange={v => setForm(f => ({ ...f, workstream: v }))} />
          </Field>
          {createError && <InlineError message={createError} />}
          <ModalActions onCancel={() => { setShowCreate(false); setCreateError(null); }}
            loading={creating} submitLabel="Create Action" />
        </form>
      </Modal>
    </>
  );
}

function ActionCard({ item, onStatusChange }) {
  const isDone = item.status === 'Complete' || item.status === 'Cancelled';
  const isOverdue = item.due_date && item.status !== 'Complete' && item.status !== 'Cancelled'
    && new Date(item.due_date) < new Date();

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      isDone ? 'opacity-60' : 'border-gray-200'
    }`}>
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-hbird-400">{item.item_id}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[item.status] || ''}`}>
              {item.status}
            </span>
          </div>
          <p className={`text-sm leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.description}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
            {item.owner && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{item.owner}</span>}
            {item.due_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                <CalendarIcon className="h-3 w-3" />
                {isOverdue ? 'Overdue · ' : ''}{fmtDate(item.due_date)}
              </span>
            )}
            {item.workstream && <span>{item.workstream}</span>}
          </div>
        </div>

        {!isDone && (
          <select
            className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white shrink-0"
            value={item.status}
            onChange={e => onStatusChange(e.target.value)}
          >
            {ACTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ─── Assumptions / Gaps tab ───────────────────────────────────────────────────

function AsmGapTab({ engagementId, wsOptions, type }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filters, setFilters] = useState({ status: '', owner: '', workstream: '' });

  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState({
    statement: '', workstream: '', owner: '',
    risk_if_wrong: '', resolution_plan: '',
  });
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);

  const load = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const res = await assumptionApi.list(engagementId, { type, ...filterParams(filters) });
      setItems(res.data || []);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [engagementId, type, filters]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.statement.trim()) { setCreateError('Statement is required.'); return; }
    setCreating(true); setCreateError(null);
    try {
      await assumptionApi.create(engagementId, { type, ...form });
      setShowCreate(false);
      setForm({ statement: '', workstream: '', owner: '', risk_if_wrong: '', resolution_plan: '' });
      load();
    } catch (e) { setCreateError(e.message); }
    finally { setCreating(false); }
  }

  async function handleStatusChange(id, status) {
    try { await assumptionApi.update(engagementId, id, { status }); load(); }
    catch (e) { console.error(e.message); }
  }

  const visible = items.filter(i =>
    (!filters.workstream || i.workstream === filters.workstream) &&
    (!filters.owner || (i.owner || '').toLowerCase().includes(filters.owner.toLowerCase()))
  );

  const icon = type === 'Gap' ? ExclamationCircleIcon : ClipboardDocumentListIcon;

  return (
    <>
      <FilterBar filters={filters} setFilters={setFilters} wsOptions={wsOptions}
        statusOptions={ASM_STATUSES} onAdd={() => setShowCreate(true)} addLabel={`New ${type}`} />
      {error && <ErrorBanner message={error} />}
      {loading && <SpinnerBlock />}

      {!loading && visible.length === 0 && (
        <EmptyState
          icon={icon}
          title={`No ${type.toLowerCase()}s yet`}
          description={
            type === 'Assumption'
              ? 'Log assumptions that carry risk if proven wrong, so they can be tracked and resolved.'
              : 'Log knowledge gaps that need investigation or stakeholder input to close.'
          }
          action={<Button icon={PlusIcon} onClick={() => setShowCreate(true)}>New {type}</Button>}
        />
      )}

      {!loading && (
        <div className="space-y-3">
          {visible.map(item => (
            <AsmGapCard key={item.item_id} item={item} type={type}
              onStatusChange={(s) => handleStatusChange(item.item_id, s)} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null); }}
        title={`New ${type}`} size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Statement *">
            <textarea autoFocus rows={3} className={TEXTAREA_CLS}
              placeholder={type === 'Assumption'
                ? 'What are we assuming to be true?'
                : 'What do we not yet know?'}
              value={form.statement}
              onChange={e => setForm(f => ({ ...f, statement: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <input type="text" className={INPUT_CLS} placeholder="Responsible party"
                value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            </Field>
            <Field label="Workstream">
              <WsSelect wsOptions={wsOptions} value={form.workstream}
                onChange={v => setForm(f => ({ ...f, workstream: v }))} />
            </Field>
          </div>
          <Field label={type === 'Assumption' ? 'Risk if wrong' : 'Impact if unresolved'}>
            <textarea rows={2} className={TEXTAREA_CLS}
              placeholder="What changes if this is incorrect?"
              value={form.risk_if_wrong}
              onChange={e => setForm(f => ({ ...f, risk_if_wrong: e.target.value }))} />
          </Field>
          <Field label="Resolution plan">
            <input type="text" className={INPUT_CLS}
              placeholder="How and when will this be resolved?"
              value={form.resolution_plan}
              onChange={e => setForm(f => ({ ...f, resolution_plan: e.target.value }))} />
          </Field>
          {createError && <InlineError message={createError} />}
          <ModalActions onCancel={() => { setShowCreate(false); setCreateError(null); }}
            loading={creating} submitLabel={`Create ${type}`} />
        </form>
      </Modal>
    </>
  );
}

function AsmGapCard({ item, type, onStatusChange }) {
  const isDone = item.status === 'Resolved' || item.status === 'Accepted Risk';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${isDone ? 'opacity-70' : ''}`}>
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-hbird-400">{item.item_id}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[item.status] || ''}`}>
              {item.status}
            </span>
          </div>
          <p className="text-sm text-gray-800 leading-snug">{item.statement}</p>
          {item.risk_if_wrong && (
            <p className="text-xs text-gray-500 mt-1.5 italic leading-snug">
              Risk: {item.risk_if_wrong}
            </p>
          )}
          {item.resolution_plan && (
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              Plan: {item.resolution_plan}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
            {item.owner && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{item.owner}</span>}
            {item.workstream && <span>{item.workstream}</span>}
          </div>
        </div>

        {!isDone && (
          <select
            className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white shrink-0"
            value={item.status}
            onChange={e => onStatusChange(e.target.value)}
          >
            {ASM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function FilterBar({ filters, setFilters, wsOptions, statusOptions, onAdd, addLabel }) {
  return (
    <div className="flex items-center gap-2 mb-5 flex-wrap">
      <select
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
        value={filters.status}
        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
      >
        <option value="">All statuses</option>
        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {wsOptions.length > 0 && (
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hbird-400 bg-white"
          value={filters.workstream}
          onChange={e => setFilters(f => ({ ...f, workstream: e.target.value }))}
        >
          <option value="">All workstreams</option>
          {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
        </select>
      )}

      <input
        type="text"
        placeholder="Filter by owner…"
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-hbird-400 w-36"
        value={filters.owner}
        onChange={e => setFilters(f => ({ ...f, owner: e.target.value }))}
      />

      <div className="ml-auto">
        <Button icon={PlusIcon} size="sm" onClick={onAdd}>{addLabel}</Button>
      </div>
    </div>
  );
}

function WsSelect({ wsOptions, value, onChange }) {
  if (wsOptions.length === 0) {
    return (
      <input type="text" className={INPUT_CLS} placeholder="Workstream"
        value={value} onChange={e => onChange(e.target.value)} />
    );
  }
  return (
    <select className={INPUT_CLS} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— None —</option>
      {wsOptions.map(ws => <option key={ws} value={ws}>{ws}</option>)}
    </select>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, loading, submitLabel }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
      <Button type="submit" loading={loading}>{submitLabel}</Button>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function InlineError({ message }) {
  return (
    <p className="text-sm text-red-600 flex items-center gap-1.5">
      <ExclamationCircleIcon className="h-4 w-4 shrink-0" />{message}
    </p>
  );
}

function SpinnerBlock() {
  return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
}

function filterParams(filters) {
  const p = {};
  if (filters.status) p.status = filters.status;
  return p;
}

const INPUT_CLS    = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent bg-white';
const TEXTAREA_CLS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent resize-none';
