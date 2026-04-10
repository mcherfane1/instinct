/**
 * Artifact Ingestion — Entity 6 (PRD §7.2)
 * Upload documents; AI extracts findings, Q&A answers, and stakeholders.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  PlusIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { artifactApi } from '../../api/client';
import useEngagementStore from '../../store/engagementStore';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';

const ARTIFACT_TYPES = [
  'Transcript',
  'Meeting Notes',
  'Report',
  'Questionnaire Response',
  'Presentation',
  'SOW',
  'Other',
];

const STATUS_CFG = {
  Pending:    { label: 'Pending',    cls: 'bg-yellow-100 text-yellow-700' },
  Processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-700', pulse: true },
  Processed:  { label: 'Processed',  cls: 'bg-green-100 text-green-700' },
  Failed:     { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
  Duplicate:  { label: 'Duplicate',  cls: 'bg-orange-100 text-orange-700' },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy'); }
  catch { return iso; }
}

function guessType(filename) {
  const n = filename.toLowerCase();
  if (/transcript/.test(n)) return 'Transcript';
  if (/meeting|notes|minutes/.test(n)) return 'Meeting Notes';
  if (/report|assessment/.test(n)) return 'Report';
  if (/questionnaire|survey|response/.test(n)) return 'Questionnaire Response';
  if (/presentation|deck|slides/.test(n)) return 'Presentation';
  if (/sow|statement.of.work/.test(n)) return 'SOW';
  return 'Other';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ArtifactIngestion() {
  const { currentEngagement, refreshStats } = useEngagementStore();
  const engagementId = currentEngagement?.engagement_id;

  const [artifacts, setArtifacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [form, setForm] = useState({ artifact_type: 'Other', provided_by: '', date_received: today() });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await artifactApi.list(engagementId);
      setArtifacts(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [engagementId]);

  useEffect(() => { load(); }, [load]);

  // Poll while any artifact is Pending or Processing
  useEffect(() => {
    clearInterval(pollRef.current);
    const hasActive = artifacts.some(
      a => a.ingestion_status === 'Pending' || a.ingestion_status === 'Processing'
    );
    if (hasActive) {
      pollRef.current = setInterval(load, 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [artifacts, load]);

  // --- Drag and drop ---
  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) openUploadModal(file);
  };
  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) openUploadModal(file);
    e.target.value = '';
  };

  function openUploadModal(file) {
    setPendingFile(file);
    setForm({ artifact_type: guessType(file.name), provided_by: '', date_received: today() });
    setUploadError(null);
    setShowUpload(true);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('artifact_type', form.artifact_type);
      if (form.provided_by.trim()) fd.append('provided_by', form.provided_by.trim());
      fd.append('date_received', form.date_received);
      await artifactApi.upload(engagementId, fd);
      setShowUpload(false);
      setPendingFile(null);
      setForm({ artifact_type: 'Other', provided_by: '', date_received: today() });
      await load();
      refreshStats();
    } catch (err) {
      if (err.status === 409) {
        setUploadError(
          `Duplicate file — this file has already been ingested (${err.data?.artifact_id || 'existing artifact'}).`
        );
      } else {
        setUploadError(err.message);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleReprocess(artifactId) {
    try {
      await artifactApi.reprocess(engagementId, artifactId);
      // Optimistically flip status so user sees feedback
      setArtifacts(prev =>
        prev.map(a => a.artifact_id === artifactId ? { ...a, ingestion_status: 'Pending' } : a)
      );
    } catch (err) {
      console.error('Reprocess failed:', err.message);
    }
  }

  async function handlePhiToggle(artifact) {
    const next = artifact.phi_flag ? 0 : 1;
    try {
      await artifactApi.update(engagementId, artifact.artifact_id, { phi_flag: next });
      setArtifacts(prev =>
        prev.map(a => a.artifact_id === artifact.artifact_id ? { ...a, phi_flag: next } : a)
      );
    } catch (err) {
      console.error('PHI toggle failed:', err.message);
    }
  }

  async function handleUpdate(artifactId, data) {
    await artifactApi.update(engagementId, artifactId, data);
    await load();
  }

  const wsOptions = currentEngagement?.workstreams
    ? JSON.parse(currentEngagement.workstreams) : [];

  const processed = artifacts.filter(a => a.ingestion_status === 'Processed');
  const inProgress = artifacts.filter(a => a.ingestion_status === 'Pending' || a.ingestion_status === 'Processing');
  const failed = artifacts.filter(a => a.ingestion_status === 'Failed');
  const other = artifacts.filter(a => !['Processed', 'Pending', 'Processing', 'Failed'].includes(a.ingestion_status));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Artifact Ingestion</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload documents, transcripts, and reports. AI extracts findings, answers open questions, and identifies stakeholders.
          </p>
        </div>
        <Button icon={PlusIcon} onClick={() => fileInputRef.current?.click()}>Upload</Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onFileInput}
          accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xlsm,.csv,.pptx"
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors duration-150 select-none ${
          isDragging
            ? 'border-hbird-400 bg-hbird-50'
            : 'border-gray-200 hover:border-hbird-300 hover:bg-gray-50'
        }`}
      >
        <DocumentArrowUpIcon
          className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDragging ? 'text-hbird-500' : 'text-gray-300'}`}
        />
        <p className="text-sm font-medium text-gray-700">
          {isDragging ? 'Drop to upload' : 'Drag and drop a file, or click to browse'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, DOCX, XLSX, PPTX, TXT, CSV — max 50 MB
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && artifacts.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={DocumentTextIcon}
            title="No artifacts yet"
            description="Upload transcripts, meeting notes, reports, or any client document. AI will extract findings and knowledge automatically."
            action={
              <Button icon={PlusIcon} onClick={() => fileInputRef.current?.click()}>
                Upload First Artifact
              </Button>
            }
          />
        </div>
      )}

      {/* Artifact lists — grouped by status */}
      {!isLoading && artifacts.length > 0 && (
        <div className="space-y-8">

          {inProgress.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Processing ({inProgress.length})
              </h2>
              <div className="space-y-3">
                {inProgress.map(a => (
                  <ArtifactCard
                    key={a.artifact_id}
                    artifact={a}
                    wsOptions={wsOptions}
                    onReprocess={handleReprocess}
                    onPhiToggle={handlePhiToggle}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </section>
          )}

          {failed.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Failed ({failed.length})
              </h2>
              <div className="space-y-3">
                {failed.map(a => (
                  <ArtifactCard
                    key={a.artifact_id}
                    artifact={a}
                    wsOptions={wsOptions}
                    onReprocess={handleReprocess}
                    onPhiToggle={handlePhiToggle}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </section>
          )}

          {processed.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Processed ({processed.length})
              </h2>
              <div className="space-y-3">
                {processed.map(a => (
                  <ArtifactCard
                    key={a.artifact_id}
                    artifact={a}
                    wsOptions={wsOptions}
                    onReprocess={handleReprocess}
                    onPhiToggle={handlePhiToggle}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Other ({other.length})
              </h2>
              <div className="space-y-3">
                {other.map(a => (
                  <ArtifactCard
                    key={a.artifact_id}
                    artifact={a}
                    wsOptions={wsOptions}
                    onReprocess={handleReprocess}
                    onPhiToggle={handlePhiToggle}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Upload modal */}
      <Modal
        open={showUpload}
        onClose={() => { if (!uploading) { setShowUpload(false); setPendingFile(null); } }}
        title="Upload Artifact"
      >
        <form onSubmit={handleUpload} className="space-y-4">

          {/* File preview */}
          {pendingFile && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(pendingFile.size)}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
              value={form.artifact_type}
              onChange={e => setForm(f => ({ ...f, artifact_type: e.target.value }))}
            >
              {ARTIFACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provided By</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                placeholder="Person or organization"
                value={form.provided_by}
                onChange={e => setForm(f => ({ ...f, provided_by: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Received</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hbird-500"
                value={form.date_received}
                onChange={e => setForm(f => ({ ...f, date_received: e.target.value }))}
              />
            </div>
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => { setShowUpload(false); setPendingFile(null); }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" icon={DocumentArrowUpIcon} loading={uploading}>
              Upload & Ingest
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact card
// ---------------------------------------------------------------------------

function ArtifactCard({ artifact: a, wsOptions, onReprocess, onPhiToggle, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editingType, setEditingType] = useState(false);

  const cfg = STATUS_CFG[a.ingestion_status] || STATUS_CFG.Pending;
  const isInProgress = a.ingestion_status === 'Pending' || a.ingestion_status === 'Processing';
  const isFailed = a.ingestion_status === 'Failed';
  const isProcessed = a.ingestion_status === 'Processed';
  const canExpand = isProcessed && (a.summary || wsOptions.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Main row */}
      <div className="px-5 py-4 flex items-center gap-4">

        {/* Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-hbird-50 shrink-0">
          <DocumentTextIcon className="h-5 w-5 text-hbird-600" />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900 truncate">{a.name}</span>

            {/* Status badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.cls} ${cfg.pulse ? 'animate-pulse' : ''}`}>
              {cfg.label}
            </span>

            {/* PHI badge */}
            {!!a.phi_flag && (
              <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-600 border border-red-200">
                <ShieldExclamationIcon className="h-3 w-3" />
                PHI — AI excluded
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span className="font-mono text-hbird-400 shrink-0">{a.artifact_id}</span>

            {/* Artifact type — click to edit inline */}
            {editingType ? (
              <select
                autoFocus
                className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-hbird-400"
                value={a.artifact_type}
                onChange={async e => {
                  await onUpdate(a.artifact_id, { artifact_type: e.target.value });
                  setEditingType(false);
                }}
                onBlur={() => setEditingType(false)}
              >
                {ARTIFACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <button
                className="hover:text-hbird-600 hover:underline transition-colors"
                onClick={() => setEditingType(true)}
                title="Click to change type"
              >
                {a.artifact_type}
              </button>
            )}

            {a.date_received && (
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {fmtDate(a.date_received)}
              </span>
            )}
            {a.provided_by && <span>from {a.provided_by}</span>}
            {a.file_size_bytes ? <span>{formatBytes(a.file_size_bytes)}</span> : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* PHI toggle */}
          <button
            title={a.phi_flag ? 'Remove PHI flag' : 'Mark PHI — exclude from AI processing'}
            onClick={() => onPhiToggle(a)}
            className={`p-1.5 rounded transition-colors ${
              a.phi_flag
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
            }`}
          >
            <ShieldExclamationIcon className="h-4 w-4" />
          </button>

          {/* Reprocess — Failed only */}
          {isFailed && (
            <button
              title="Reprocess"
              onClick={() => onReprocess(a.artifact_id)}
              className="p-1.5 rounded text-gray-400 hover:text-hbird-600 hover:bg-hbird-50 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}

          {/* In-progress spinner */}
          {isInProgress && <Spinner size="sm" />}

          {/* Expand — Processed with content */}
          {canExpand && (
            <button
              onClick={() => setExpanded(o => !o)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ChevronDownIcon className={`h-4 w-4 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && isProcessed && (
        <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50">

          {a.summary && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">AI Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{a.summary}</p>
            </div>
          )}

          {wsOptions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Workstreams Covered
                <span className="ml-1 font-normal normal-case text-gray-400">(click to toggle)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {wsOptions.map(ws => {
                  const covered = (a.workstreams_covered || []).includes(ws);
                  return (
                    <button
                      key={ws}
                      onClick={async () => {
                        const current = a.workstreams_covered || [];
                        const next = covered
                          ? current.filter(w => w !== ws)
                          : [...current, ws];
                        await onUpdate(a.artifact_id, { workstreams_covered: next });
                      }}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                        covered
                          ? 'bg-hbird-100 border-hbird-300 text-hbird-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-400 hover:border-hbird-200 hover:text-hbird-500'
                      }`}
                    >
                      {ws}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failed error footer */}
      {isFailed && (
        <div className="px-5 py-2.5 border-t border-red-100 bg-red-50">
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <ExclamationCircleIcon className="h-3.5 w-3.5 shrink-0" />
            Ingestion failed. Check the file format and click the reprocess button, or upload a corrected version.
          </p>
        </div>
      )}
    </div>
  );
}
