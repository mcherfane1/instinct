import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Cog6ToothIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import useEngagementStore from '../../store/engagementStore';
import { engagementApi } from '../../api/client';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

const STEPS = [
  { id: 1, label: 'Identity & Scope' },
  { id: 2, label: 'SharePoint' },
  { id: 3, label: 'Document Scope' },
  { id: 4, label: 'SOW Review' },
  { id: 5, label: 'Initial Ingestion' },
  { id: 6, label: 'Questionnaire Seeding' },
];

export default function EngagementSetup() {
  const { engagementId } = useParams();
  const navigate          = useNavigate();
  const { currentEngagement, loadEngagement } = useEngagementStore();

  const [step, setStep]     = useState(1);
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    loadEngagement(engagementId);
  }, [engagementId]);

  useEffect(() => {
    if (currentEngagement && !form) {
      setForm({
        client_name:      currentEngagement.client_name      || '',
        engagement_name:  currentEngagement.engagement_name  || '',
        start_date:       currentEngagement.start_date        || '',
        workstreams:      (currentEngagement.workstreams      ? JSON.parse(currentEngagement.workstreams)     : []).join(', '),
        contact_centers:  (currentEngagement.contact_centers ? JSON.parse(currentEngagement.contact_centers) : []).join(', '),
        technologies:     (currentEngagement.technologies    ? JSON.parse(currentEngagement.technologies)    : []).join(', '),
        sows:             (currentEngagement.sows             ? JSON.parse(currentEngagement.sows)            : []).join(', '),
      });
    }
  }, [currentEngagement]);

  if (!form) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  async function saveStep1() {
    setSaving(true);
    setError(null);
    try {
      await engagementApi.update(engagementId, {
        client_name:     form.client_name,
        engagement_name: form.engagement_name,
        start_date:      form.start_date || null,
        workstreams:     form.workstreams.split(',').map(s => s.trim()).filter(Boolean),
        contact_centers: form.contact_centers.split(',').map(s => s.trim()).filter(Boolean),
        technologies:    form.technologies.split(',').map(s => s.trim()).filter(Boolean),
        sows:            form.sows.split(',').map(s => s.trim()).filter(Boolean),
      });
      await loadEngagement(engagementId);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function field(label, key, placeholder, hint) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  const stepContent = {
    1: (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Define the engagement identity and controlled vocabulary for tagging.
        </p>
        {field('Client Name *', 'client_name', 'e.g. Regional Health System')}
        {field('Engagement Name *', 'engagement_name', 'e.g. Contact Center Assessment 2026')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500 focus:border-transparent"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        {field('Workstreams', 'workstreams', 'e.g. Technology, Process, People', 'Comma-separated. Used as tags across all knowledge records.')}
        {field('Contact Centers', 'contact_centers', 'e.g. Main Campus, Regional Office', 'Comma-separated site names.')}
        {field('Technologies', 'technologies', 'e.g. Salesforce, Genesys Cloud', 'Comma-separated technology names.')}
        {field('SOW Documents', 'sows', 'e.g. SOW-2026-001', 'Comma-separated SOW identifiers.')}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end pt-2">
          <Button onClick={saveStep1} loading={saving}>Save & Continue</Button>
        </div>
      </div>
    ),
    2: (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Cog6ToothIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">SharePoint Integration — Phase 3</p>
            <p className="text-xs text-amber-600 mt-1">
              SharePoint / Microsoft 365 connection requires Azure AD credentials that are not yet configured.
              This step is fully stubbed for local development. Document uploads will use local storage.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          When Azure AD credentials are available, this step will connect to your SharePoint site and configure folder mappings for artifact synchronization.
        </p>
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
          <Button onClick={() => setStep(3)}>Skip for Now</Button>
        </div>
      </div>
    ),
    3: (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Specify which document types and workstreams to include or exclude from AI processing.
        </p>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">Document scope configuration coming in Step 8 full implementation.</p>
          <p className="text-xs text-gray-400 mt-1">For now, all non-PHI artifacts will be processed by the AI pipeline.</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
          <Button onClick={() => setStep(4)}>Continue</Button>
        </div>
      </div>
    ),
    4: (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Upload and review Statement of Work documents to extract engagement scope, deliverables, and constraints.
        </p>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">SOW analysis coming in Step 8 full implementation.</p>
          <p className="text-xs text-gray-400 mt-1">SOW documents can be uploaded via Artifact Ingestion in the meantime.</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
          <Button onClick={() => setStep(5)}>Continue</Button>
        </div>
      </div>
    ),
    5: (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Optionally upload initial artifacts to seed the knowledge base before interviews begin.
        </p>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">Initial ingestion coming in Step 8 full implementation.</p>
          <p className="text-xs text-gray-400 mt-1">Use the Artifact Ingestion module to upload documents at any time.</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
          <Button onClick={() => setStep(6)}>Continue</Button>
        </div>
      </div>
    ),
    6: (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Generate an initial Q&A tracker seeded from the SOW and engagement scope using AI.
        </p>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">Questionnaire seeding coming in Step 8 full implementation.</p>
          <p className="text-xs text-gray-400 mt-1">Questions can be added manually in the Knowledge Hub at any time.</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={() => setStep(5)}>Back</Button>
          <Button
            icon={CheckCircleIcon}
            onClick={() => navigate(`/engagements/${engagementId}/knowledge-hub`)}
          >
            Finish Setup
          </Button>
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Engagement Setup</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {currentEngagement?.engagement_name} — {currentEngagement?.client_name}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => s.id < step && setStep(s.id)}
              className={`flex flex-col items-center min-w-0 ${s.id < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`
                flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
                ${s.id === step  ? 'bg-hbird-600 text-white' : ''}
                ${s.id < step   ? 'bg-hbird-200 text-hbird-700' : ''}
                ${s.id > step   ? 'bg-gray-100 text-gray-400' : ''}
              `}>
                {s.id < step ? '✓' : s.id}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight max-w-[56px] ${s.id === step ? 'text-hbird-700 font-medium' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mb-4 mx-1 ${s.id < step ? 'bg-hbird-300' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Step {step}: {STEPS[step - 1].label}
        </h2>
        {stepContent[step]}
      </div>
    </div>
  );
}
