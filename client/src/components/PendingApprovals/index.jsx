import React from 'react';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import useEngagementStore from '../../store/engagementStore';

export default function PendingApprovals() {
  const { pendingApprovals } = useEngagementStore();

  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-hbird-50 mb-4">
        <BellAlertIcon className="h-8 w-8 text-hbird-400" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Pending Approvals</h2>
      {pendingApprovals > 0 ? (
        <p className="text-sm text-amber-600 font-medium">
          {pendingApprovals} metadata suggestion{pendingApprovals !== 1 ? 's' : ''} awaiting review.
        </p>
      ) : (
        <p className="text-sm text-gray-500 max-w-sm">
          Metadata schema suggestions from AI extractions will appear here for Engagement Lead review.
        </p>
      )}
    </div>
  );
}
