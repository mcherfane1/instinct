import React from 'react';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

export default function TaskTracker() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-hbird-50 mb-4">
        <ClipboardDocumentListIcon className="h-8 w-8 text-hbird-400" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Engagement Task Tracker</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Track decisions, actions, assumptions, and gaps across the engagement. Coming in Step 7.
      </p>
    </div>
  );
}
