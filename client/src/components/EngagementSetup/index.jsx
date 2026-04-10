/**
 * Engagement Setup Wizard — PRD §8
 * Six steps: Identity → SharePoint → Document Scope → SOW Review → Initial Ingestion → Questionnaire Seeding
 *
 * Steps 2, 3, 5 are Phase 3 (SharePoint) — functional shells with degraded-state UI.
 * Steps 1, 4, 6 are fully live in Phase 1.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronUpDownIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { aiApi, engagementApi, questionApi } from '../../api/client';
import useEngagementStore from '../../store/engagementStore';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identity & Scope' },
  { id: 2, label: 'SharePoint' },
  { id: 3, label: 'Document Scope' },
  { id: 4, label: 'SOW Review' },
  { id: 5, label: 'Initial Ingestion' },
  { id: 6, label: 'Questionnaire Seeding' },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

const INPUT_CLS    = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent';
const TEXTAREA_CLS = INPUT_CLS + ' resize-none';

function Label({ children, hint }) {
  return (
    <div className="mb-1">
      <label className="block text-sm font-medium text-gray-700">{children}</label>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function PhaseNotice({ title, body }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <Cog6ToothIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">{title}</p>
        <p className="text-xs text-amber-700 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel = 'Continue', nextIcon, nextLoading, skipLabel, onSkip, disableNext }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <div>
        {onBack && <Button variant="secondary" onClick={onBack}>Back</Button>}
      </div>
      <div className="flex items-center gap-2">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>{skipLabel || 'Skip'}</Button>
        )}
        {onNext && (
          <Button onClick={onNext} icon={nextIcon} loading={nextLoading} disabled={disableNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main wizard shell ────────────────────────────────────────────────────────

export default function EngagementSetup() {
  const { engagementId } = useParams();
  const navigate          = useNavigate();
  const { currentEngagement, loadEngagement, patchEngagement } = useEngagementStore();

  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(null);

  useEffect(() => { loadEngagement(engagementId); }, [engagementId]);

  useEffect(() => {
    if (currentEngagement && !form) {
      setForm({
        client_name:     currentEngagement.client_name      || '',
        engagement_name: currentEngagement.engagement_name  || '',
        start_date:      currentEngagement.start_date       || '',
        workstreams:     (currentEngagement.workstreams     || []).join(', '),
        contact_centers: (currentEngagement.contact_centers || []).join(', '),
        technologies:    (currentEngagement.technologies    || []).join(', '),
        sows:            (currentEngagement.sows            || []).join(', '),
      });
    }
  }, [currentEngagement]);

  const go   = (n) => setStep(n);
  const next = ()  => setStep(s => Math.min(s + 1, 6));
  const back = ()  => setStep(s => Math.max(s - 1, 1));

  if (!form) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  const stepProps = {
    engagementId,
    currentEngagement,
    form, setForm,
    loadEngagement,
    patchEngagement,
    onNext: next,
    onBack: back,
    onGoTo: go,
    navigate,
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Engagement Setup</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {currentEngagement?.engagement_name} — {currentEngagement?.client_name}
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={STEPS} current={step} onClickPast={go} />

      {/* Content card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">
          Step {step}: {STEPS[step - 1].label}
        </h2>

        {step === 1 && <Step1Identity {...stepProps} />}
        {step === 2 && <Step2SharePoint {...stepProps} />}
        {step === 3 && <Step3DocumentScope {...stepProps} />}
        {step === 4 && <Step4SowReview {...stepProps} />}
        {step === 5 && <Step5Ingestion {...stepProps} />}
        {step === 6 && <Step6Questions {...stepProps} />}
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ steps, current, onClickPast }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <button
            onClick={() => s.id < current && onClickPast(s.id)}
            className={`flex flex-col items-center min-w-0 ${s.id < current ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
              ${s.id === current ? 'bg-hbird-600 text-white' : ''}
              ${s.id < current  ? 'bg-hbird-200 text-hbird-700' : ''}
              ${s.id > current  ? 'bg-gray-100 text-gray-400' : ''}
            `}>
              {s.id < current ? '✓' : s.id}
            </div>
            <span className={`text-[10px] mt-1 text-center leading-tight max-w-[56px] ${
              s.id === current ? 'text-hbird-700 font-medium' : 'text-gray-400'
            }`}>
              {s.label}
            </span>
          </button>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mb-4 mx-1 ${s.id < current ? 'bg-hbird-300' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Step 1: Identity & Scope (already functional) ───────────────────────────

function Step1Identity({ engagementId, form, setForm, loadEngagement, patchEngagement, onNext }) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  async function save() {
    if (!form.client_name.trim() || !form.engagement_name.trim()) {
      setError('Client name and engagement name are required.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const updated = await engagementApi.update(engagementId, {
        client_name:     form.client_name.trim(),
        engagement_name: form.engagement_name.trim(),
        start_date:      form.start_date || null,
        workstreams:     form.workstreams.split(',').map(s => s.trim()).filter(Boolean),
        contact_centers: form.contact_centers.split(',').map(s => s.trim()).filter(Boolean),
        technologies:    form.technologies.split(',').map(s => s.trim()).filter(Boolean),
        sows:            form.sows.split(',').map(s => s.trim()).filter(Boolean),
      });
      patchEngagement(updated.data);
      onNext();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Define the engagement identity and controlled vocabulary used for tagging across all knowledge records.
      </p>

      <div>
        <Label>Client Name <span className="text-red-500">*</span></Label>
        <input className={INPUT_CLS} placeholder="e.g. Regional Health System"
          value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
      </div>

      <div>
        <Label>Engagement Name <span className="text-red-500">*</span></Label>
        <input className={INPUT_CLS} placeholder="e.g. Contact Center Assessment 2026"
          value={form.engagement_name} onChange={e => setForm(f => ({ ...f, engagement_name: e.target.value }))} />
      </div>

      <div>
        <Label>Start Date</Label>
        <input type="date" className={INPUT_CLS}
          value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
      </div>

      <div>
        <Label hint="Comma-separated. Used as tags across all knowledge records.">Workstreams</Label>
        <input className={INPUT_CLS} placeholder="e.g. Technology, Process, People, Reporting"
          value={form.workstreams} onChange={e => setForm(f => ({ ...f, workstreams: e.target.value }))} />
      </div>

      <div>
        <Label hint="Comma-separated site or location names.">Contact Centers</Label>
        <input className={INPUT_CLS} placeholder="e.g. Main Campus, Regional Office, Northside"
          value={form.contact_centers} onChange={e => setForm(f => ({ ...f, contact_centers: e.target.value }))} />
      </div>

      <div>
        <Label hint="Comma-separated technology names in scope.">Technologies</Label>
        <input className={INPUT_CLS} placeholder="e.g. Genesys Cloud, Epic, Salesforce"
          value={form.technologies} onChange={e => setForm(f => ({ ...f, technologies: e.target.value }))} />
      </div>

      <div>
        <Label hint="Comma-separated SOW identifiers. Used for scoping and SOW review.">SOW Documents</Label>
        <input className={INPUT_CLS} placeholder="e.g. SOW-2026-001, SOW-2026-002"
          value={form.sows} onChange={e => setForm(f => ({ ...f, sows: e.target.value }))} />
      </div>

      <InlineError message={error} />

      <NavRow onNext={save} nextLabel="Save & Continue" nextLoading={saving} />
    </div>
  );
}

// ─── Step 2: SharePoint Connection (Phase 3 shell) ────────────────────────────

function Step2SharePoint({ currentEngagement, onBack, onNext }) {
  return (
    <div className="space-y-5">
      <PhaseNotice
        title="SharePoint Integration — Phase 3"
        body="Microsoft 365 / Azure AD authentication is not yet configured. SharePoint connection will be enabled in Phase 3 deployment. All document uploads in Phase 1 use local storage and the knowledge model is fully functional without SharePoint."
      />

      <p className="text-sm text-gray-600 font-medium">What this step will configure:</p>
      <div className="space-y-3">
        {[
          {
            icon: CloudArrowUpIcon,
            label: 'SharePoint Site Connection',
            desc: 'Authenticate via Azure AD SSO and connect to the engagement SharePoint site.',
            field: 'sharepoint_site_url',
            placeholder: 'https://hummingbird.sharepoint.com/sites/engagement',
          },
          {
            icon: FolderOpenIcon,
            label: 'Root Project Directory',
            desc: 'Select the parent folder for this engagement. Instinct will create a subfolder here.',
            field: 'sharepoint_parent_folder_id',
            placeholder: 'Browse to select folder…',
          },
          {
            icon: FolderOpenIcon,
            label: 'Session Notes Destination',
            desc: 'Folder where Interview Studio session exports will be written.',
            field: 'session_notes_folder_id',
            placeholder: 'Browse to select folder…',
          },
        ].map(item => (
          <div key={item.field} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50 opacity-60">
            <item.icon className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{item.label}</p>
              <p className="text-xs text-gray-400 mb-1.5">{item.desc}</p>
              <input disabled className={INPUT_CLS + ' bg-white opacity-60 cursor-not-allowed'}
                placeholder={item.placeholder}
                value={currentEngagement?.[item.field] || ''}
                readOnly />
            </div>
          </div>
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} skipLabel="Skip — Phase 3" onSkip={onNext} nextLabel="Continue" />
    </div>
  );
}

// ─── Step 3: Document Scope (Phase 3 shell) ───────────────────────────────────

function Step3DocumentScope({ onBack, onNext }) {
  return (
    <div className="space-y-5">
      <PhaseNotice
        title="Document Scope Selection — Phase 3"
        body="Document scope selection requires an active SharePoint connection. In Phase 1, all non-PHI artifacts uploaded through the Artifact Ingestion module are processed by the AI pipeline. PHI exclusion is managed per-artifact using the PHI flag in the Artifact Registry."
      />

      <p className="text-sm text-gray-600 font-medium">What this step will configure:</p>
      <div className="space-y-3">
        {[
          {
            label: 'Include All Documents',
            desc: 'All documents in the connected SharePoint site included in the watch scope.',
          },
          {
            label: 'Select Specific Documents / Folders',
            desc: 'Browse the SharePoint file tree and check individual files or folders to include. Unchecked items can be permanently excluded or deferred.',
          },
          {
            label: 'Permanent Exclusion List',
            desc: 'Files and folders permanently excluded from AI processing — never ingested, even if they change.',
          },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50 opacity-60">
            <ChevronUpDownIcon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-600">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
        <strong>Phase 1 status:</strong> Use the PHI flag (shield icon) in Artifact Ingestion to exclude sensitive files from AI processing. All other uploaded files are processed automatically.
      </div>

      <NavRow onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

// ─── Step 4: SOW Review (live AI) ────────────────────────────────────────────

function Step4SowReview({ engagementId, currentEngagement, patchEngagement, onBack, onNext }) {
  const fileRef = useRef(null);

  const [sowText, setSowText]         = useState('');
  const [fileName, setFileName]       = useState('');
  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [proposal, setProposal]       = useState(null); // AI result

  // Editable proposed lists (seeded from AI, user can modify)
  const [proposed, setProposed] = useState({
    workstreams: [], contact_centers: [], technologies: [],
    scope_summary: '', key_deliverables: [], out_of_scope: [],
  });

  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved]     = useState(false);

  // Current controlled vocab from engagement
  const existing = {
    workstreams:     currentEngagement?.workstreams     || [],
    contact_centers: currentEngagement?.contact_centers || [],
    technologies:    currentEngagement?.technologies    || [],
  };

  async function handleFileRead(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text().catch(() => '');
    setSowText(text.slice(0, 40000));
    e.target.value = '';
  }

  async function analyze() {
    if (!sowText.trim()) { setAnalyzeError('Paste or upload SOW content first.'); return; }
    setAnalyzing(true); setAnalyzeError(null); setProposal(null); setSaved(false);
    try {
      const res = await aiApi.sowAnalysis(engagementId, sowText);
      const data = res.data;
      setProposal(data);
      setProposed({
        workstreams:      data.workstreams      || [],
        contact_centers:  data.contact_centers  || [],
        technologies:     data.technologies     || [],
        scope_summary:    data.scope_summary    || '',
        key_deliverables: data.key_deliverables || [],
        out_of_scope:     data.out_of_scope     || [],
      });
    } catch (e) {
      setAnalyzeError(e.message || 'AI analysis failed. Check that ANTHROPIC_API_KEY is configured.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveProposal() {
    setSaving(true); setSaveError(null);
    // Merge proposed lists with existing (union), dedup
    const merge = (existing, proposed) =>
      [...new Set([...existing, ...proposed.filter(Boolean)])];

    try {
      const updated = await engagementApi.update(engagementId, {
        workstreams:      merge(existing.workstreams,     proposed.workstreams),
        contact_centers:  merge(existing.contact_centers, proposed.contact_centers),
        technologies:     merge(existing.technologies,    proposed.technologies),
        sow_review_status: 'Reviewed',
      });
      patchEngagement(updated.data);
      setSaved(true);
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Paste or upload a Statement of Work. The AI will extract proposed workstreams, contact centers, technologies, and scope boundaries to seed the Core Config.
      </p>

      {currentEngagement?.sow_review_status === 'Reviewed' && !proposal && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          SOW already reviewed. You can re-run analysis if needed or skip this step.
        </div>
      )}

      {/* Input area */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>SOW Content</Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-hbird-600 hover:text-hbird-800"
          >
            <DocumentArrowUpIcon className="h-3.5 w-3.5" />
            Upload .txt / .md file
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileRead} />
        </div>
        {fileName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <DocumentTextIcon className="h-3.5 w-3.5" />
            {fileName}
            <button onClick={() => { setFileName(''); setSowText(''); }}
              className="text-gray-400 hover:text-red-400">
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        )}
        <textarea
          rows={8}
          className={TEXTAREA_CLS}
          placeholder="Paste Statement of Work content here (or upload a .txt file above)…"
          value={sowText}
          onChange={e => setSowText(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">
          {sowText.length.toLocaleString()} / 40,000 characters
          {sowText.length > 30000 && <span className="text-amber-600"> — long documents will be truncated</span>}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button icon={SparklesIcon} onClick={analyze} loading={analyzing} disabled={!sowText.trim()}>
          Analyze with AI
        </Button>
        {analyzeError && <span className="text-xs text-red-600">{analyzeError}</span>}
      </div>

      {/* AI proposal */}
      {proposal && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <SparklesIcon className="h-4 w-4 text-hbird-500" />
            AI Proposal — review and edit before saving
          </p>

          {proposed.scope_summary && (
            <div className="bg-hbird-50 border border-hbird-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-hbird-700 mb-1 uppercase tracking-wide">Scope Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{proposed.scope_summary}</p>
            </div>
          )}

          <EditableList
            label="Proposed Workstreams"
            existing={existing.workstreams}
            items={proposed.workstreams}
            onChange={v => setProposed(p => ({ ...p, workstreams: v }))}
          />

          <EditableList
            label="Proposed Contact Centers"
            existing={existing.contact_centers}
            items={proposed.contact_centers}
            onChange={v => setProposed(p => ({ ...p, contact_centers: v }))}
          />

          <EditableList
            label="Proposed Technologies"
            existing={existing.technologies}
            items={proposed.technologies}
            onChange={v => setProposed(p => ({ ...p, technologies: v }))}
          />

          {proposed.key_deliverables.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Deliverables (reference only)</p>
              <ul className="space-y-1">
                {proposed.key_deliverables.map((d, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-300 mt-0.5">•</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proposed.out_of_scope.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Out of Scope (reference only)</p>
              <ul className="space-y-1">
                {proposed.out_of_scope.map((d, i) => (
                  <li key={i} className="text-sm text-gray-500 flex items-start gap-1.5">
                    <span className="text-red-300 mt-0.5">✕</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircleIcon className="h-4 w-4 shrink-0" />
              Core Config updated. Proposed values merged into controlled vocabulary.
            </div>
          )}

          <InlineError message={saveError} />

          <Button onClick={saveProposal} loading={saving} disabled={saved}>
            {saved ? 'Saved' : 'Accept & Save to Core Config'}
          </Button>
        </div>
      )}

      <NavRow
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        onSkip={onNext}
        skipLabel="Skip — no SOW"
      />
    </div>
  );
}

// Editable tag list for the SOW proposal
function EditableList({ label, existing = [], items, onChange }) {
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  }

  function remove(v) { onChange(items.filter(i => i !== v)); }

  const isNew  = (v) => !existing.includes(v);
  const exists = (v) => existing.includes(v);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {items.map(v => (
          <span key={v} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            isNew(v)
              ? 'bg-hbird-50 border-hbird-300 text-hbird-700'
              : 'bg-gray-100 border-gray-200 text-gray-500'
          }`}>
            {isNew(v) && <SparklesIcon className="h-2.5 w-2.5 text-hbird-400" />}
            {v}
            <button onClick={() => remove(v)} className="text-gray-400 hover:text-red-400 ml-0.5">
              <XMarkIcon className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-gray-400 italic">None proposed — add manually below</span>
        )}
      </div>
      {existing.filter(e => !items.includes(e)).length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-gray-400 mb-1">Already in Core Config (not duplicated):</p>
          <div className="flex flex-wrap gap-1">
            {existing.filter(e => !items.includes(e)).map(v => (
              <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-400">{v}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-hbird-400"
          placeholder="Add value…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button
          type="button"
          onClick={add}
          className="p-1.5 text-hbird-500 hover:text-hbird-700 hover:bg-hbird-50 rounded-lg transition-colors"
        >
          <PlusCircleIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Initial Ingestion (stats + redirect) ─────────────────────────────

function Step5Ingestion({ engagementId, currentEngagement, onBack, onNext, navigate }) {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    engagementApi.stats(engagementId)
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [engagementId]);

  const hasArtifacts = stats?.artifacts > 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Upload source documents to seed the knowledge base before interviews begin. The AI will extract findings, answer open questions, and identify stakeholders.
      </p>

      {/* Stats summary */}
      {loading && <div className="flex justify-center py-6"><Spinner /></div>}

      {!loading && stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Artifacts Uploaded', value: stats.artifacts, sub: `${stats.artifactsProcessed} processed` },
            { label: 'Findings Extracted', value: stats.findings, sub: `${stats.findingsNeedReview} need review` },
            { label: 'Questions Seeded', value: stats.questions, sub: `${stats.questionsOpen} still open` },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-bold text-hbird-600">{s.value}</p>
              <p className="text-xs font-medium text-gray-600 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* SharePoint notice */}
      <PhaseNotice
        title="Auto-ingestion via SharePoint — Phase 3"
        body="In Phase 3, Instinct will automatically ingest all in-scope SharePoint documents and subscribe to change notifications for new files. In Phase 1, upload documents manually via the Artifact Ingestion module."
      />

      {/* CTA */}
      <div className="flex items-center gap-3 p-4 border border-hbird-200 bg-hbird-50 rounded-lg">
        <DocumentArrowUpIcon className="h-6 w-6 text-hbird-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">
            {hasArtifacts ? 'Upload more artifacts' : 'Upload your first artifacts'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Supports PDF, DOCX, XLSX, PPTX, TXT — up to 50 MB per file.
          </p>
        </div>
        <Button
          size="sm"
          icon={ArrowRightIcon}
          onClick={() => navigate(`/engagements/${engagementId}/artifacts`)}
        >
          Go to Artifact Ingestion
        </Button>
      </div>

      <NavRow
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue to Questions"
      />
    </div>
  );
}

// ─── Step 6: Questionnaire Seeding (live AI + manual) ────────────────────────

function Step6Questions({ engagementId, onBack, navigate }) {
  const [existingCount, setExistingCount] = useState(null);
  const [generating, setGenerating]       = useState(false);
  const [genError, setGenError]           = useState(null);
  const [generated, setGenerated]         = useState([]); // [{ section, question_text, selected }]
  const [committing, setCommitting]       = useState(false);
  const [committed, setCommitted]         = useState(0);
  const [commitError, setCommitError]     = useState(null);

  // Manual add
  const [manualSection, setManualSection] = useState('');
  const [manualText, setManualText]       = useState('');
  const [manualAdding, setManualAdding]   = useState(false);
  const [manualError, setManualError]     = useState(null);
  const [manualAdded, setManualAdded]     = useState(0);

  useEffect(() => {
    questionApi.list(engagementId)
      .then(r => setExistingCount(r.data.length))
      .catch(() => setExistingCount(0));
  }, [engagementId, committed, manualAdded]);

  async function generate() {
    setGenerating(true); setGenError(null); setGenerated([]); setCommitted(0);
    try {
      const res = await aiApi.generateQuestions(engagementId);
      const qs  = res.data.questions || [];
      setGenerated(qs.map(q => ({ ...q, selected: true, id: Math.random() })));
    } catch (e) {
      setGenError(e.message || 'AI generation failed. Check that ANTHROPIC_API_KEY is configured.');
    } finally {
      setGenerating(false);
    }
  }

  function toggleAll(val) {
    setGenerated(qs => qs.map(q => ({ ...q, selected: val })));
  }

  async function commitSelected() {
    const selected = generated.filter(q => q.selected);
    if (!selected.length) return;
    setCommitting(true); setCommitError(null);
    try {
      const res = await questionApi.bulk(engagementId, selected.map(q => ({
        section:       q.section || null,
        question_text: q.question_text,
      })));
      setCommitted(res.data.created);
      setGenerated([]); // clear after commit
    } catch (e) { setCommitError(e.message); }
    finally { setCommitting(false); }
  }

  async function addManual(e) {
    e.preventDefault();
    if (!manualText.trim()) { setManualError('Question text is required.'); return; }
    setManualAdding(true); setManualError(null);
    try {
      await questionApi.create(engagementId, {
        section:       manualSection.trim() || null,
        question_text: manualText.trim(),
      });
      setManualAdded(n => n + 1);
      setManualText(''); setManualSection('');
    } catch (e) { setManualError(e.message); }
    finally { setManualAdding(false); }
  }

  // Group generated questions by section
  const sections = generated.reduce((acc, q) => {
    const sec = q.section || 'General';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(q);
    return acc;
  }, {});

  const selectedCount = generated.filter(q => q.selected).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Seed the Q&A Tracker with discovery questions. Generate them from the engagement context using AI, add questions manually, or both.
      </p>

      {/* Existing count */}
      {existingCount !== null && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
          existingCount > 0
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          {existingCount > 0
            ? `${existingCount} question${existingCount !== 1 ? 's' : ''} already in the tracker.`
            : 'No questions seeded yet.'}
        </div>
      )}

      {/* ── Method 1: AI Generation ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-hbird-500" />
          <span className="text-sm font-semibold text-gray-700">Generate from AI</span>
          <span className="ml-auto text-xs text-gray-400">Uses SOW and Core Config as context</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button icon={SparklesIcon} onClick={generate} loading={generating}>
              Generate Discovery Questions
            </Button>
            {generated.length > 0 && !committing && (
              <span className="text-xs text-gray-500">{generated.length} questions generated</span>
            )}
          </div>

          {genError && <InlineError message={genError} />}

          {/* Generated question list */}
          {generated.length > 0 && (
            <div className="space-y-3">
              {/* Select all / none */}
              <div className="flex items-center gap-3 py-1 border-b border-gray-100">
                <button onClick={() => toggleAll(true)}
                  className="text-xs text-hbird-600 hover:underline">Select all</button>
                <span className="text-gray-300">·</span>
                <button onClick={() => toggleAll(false)}
                  className="text-xs text-gray-400 hover:underline">Deselect all</button>
                <span className="ml-auto text-xs text-gray-500">
                  {selectedCount} of {generated.length} selected
                </span>
              </div>

              {Object.entries(sections).map(([section, qs]) => (
                <div key={section}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{section}</p>
                  <div className="space-y-1.5">
                    {qs.map(q => (
                      <label key={q.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          q.selected
                            ? 'bg-hbird-50 border-hbird-200'
                            : 'bg-white border-gray-100 opacity-60'
                        }`}>
                        <input
                          type="checkbox"
                          checked={q.selected}
                          onChange={() => setGenerated(prev =>
                            prev.map(p => p.id === q.id ? { ...p, selected: !p.selected } : p)
                          )}
                          className="mt-0.5 h-3.5 w-3.5 text-hbird-600 rounded border-gray-300 focus:ring-hbird-500"
                        />
                        <span className="text-sm text-gray-700 leading-snug">{q.question_text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <InlineError message={commitError} />

              {committed > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircleIcon className="h-4 w-4 shrink-0" />
                  {committed} question{committed !== 1 ? 's' : ''} added to the Q&A Tracker.
                </div>
              )}

              <Button
                onClick={commitSelected}
                loading={committing}
                disabled={selectedCount === 0 || committed > 0}
              >
                Add {selectedCount > 0 ? `${selectedCount} Selected` : 'Selected'} Questions to Tracker
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Method 2: Manual add ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <PlusCircleIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Add Question Manually</span>
        </div>
        <form onSubmit={addManual} className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
              <input type="text" className={INPUT_CLS}
                placeholder="e.g. Tech Stack"
                value={manualSection}
                onChange={e => setManualSection(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Question *</label>
              <input type="text" className={INPUT_CLS}
                placeholder="e.g. What is the current IVR platform?"
                value={manualText}
                onChange={e => setManualText(e.target.value)} />
            </div>
          </div>
          <InlineError message={manualError} />
          {manualAdded > 0 && (
            <p className="text-xs text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5 inline mr-1" />
              {manualAdded} question{manualAdded !== 1 ? 's' : ''} added this session.
            </p>
          )}
          <Button type="submit" size="sm" icon={PlusCircleIcon} loading={manualAdding}>
            Add Question
          </Button>
        </form>
      </div>

      {/* ── Method 3: HH Library (Coming Soon) ── */}
      <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50 opacity-60">
        <FolderOpenIcon className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-600">Pull from Hummingbird Question Library</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Browse the master question library and import a filtered set. Coming Soon — requires library configuration.
          </p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button
          icon={CheckCircleIcon}
          onClick={() => navigate(`/engagements/${engagementId}/knowledge-hub`)}
        >
          Finish Setup
        </Button>
      </div>
    </div>
  );
}
