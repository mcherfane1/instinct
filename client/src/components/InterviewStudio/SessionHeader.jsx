import React, { useState } from 'react';
import {
  ArrowLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import useSessionStore from '../../store/sessionStore';
import Button from '../common/Button';
import { exportSessionMarkdown, exportSessionJSON } from './exportUtils';

export default function SessionHeader({ session, elapsedSeconds, engagementId, onClose, onBack, isClosed }) {
  const { lastSavedAt, syncError, isSaving } = useSessionStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  function handleExportMd() {
    exportSessionMarkdown(session);
    setShowExportMenu(false);
  }
  function handleExportJson() {
    exportSessionJSON(session);
    setShowExportMenu(false);
  }

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 z-10">
      {/* Back */}
      <button onClick={onBack}
        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
        title="All sessions"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>

      {/* Session identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{session.name}</h1>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
            isClosed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
          }`}>
            {isClosed ? 'Closed' : 'Active'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
          {session.date && <span>{fmtDate(session.date)}</span>}
          {session.workstream && <span className="text-hbird-500">{session.workstream}</span>}
          {session.contact_center && <span>{session.contact_center}</span>}
        </div>
      </div>

      {/* Timer */}
      {!isClosed && (
        <div className="flex items-center gap-1.5 text-sm font-mono text-gray-600 shrink-0">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span>{formatElapsed(elapsedSeconds)}</span>
        </div>
      )}

      {/* Autosave indicator */}
      <div className="flex items-center gap-1.5 text-xs shrink-0">
        {syncError ? (
          <span className="flex items-center gap-1 text-amber-600">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Sync error — local copy safe
          </span>
        ) : lastSavedAt ? (
          <span className="flex items-center gap-1 text-gray-400">
            <CloudArrowUpIcon className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
      </div>

      {/* Export */}
      <div className="relative shrink-0">
        <Button variant="ghost" size="sm" icon={ArrowDownTrayIcon}
          onClick={() => setShowExportMenu(m => !m)}
        >
          Export
        </Button>
        {showExportMenu && (
          <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
            <button onClick={handleExportMd}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Export as Markdown
            </button>
            <button onClick={handleExportJson}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Export as JSON
            </button>
          </div>
        )}
      </div>

      {/* Close session */}
      {!isClosed && (
        <Button size="sm" icon={CheckCircleIcon} onClick={onClose}>
          Close Session
        </Button>
      )}
    </header>
  );
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(iso) {
  try { return format(parseISO(iso), 'MMM d, yyyy'); }
  catch { return iso; }
}
