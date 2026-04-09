import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { PageSpinner } from '../components/common/Spinner';
import useEngagementStore from '../store/engagementStore';

export default function EngagementShell() {
  const { engagementId } = useParams();
  const navigate          = useNavigate();
  const { currentEngagement, isLoading, error, loadEngagement } = useEngagementStore();

  useEffect(() => {
    loadEngagement(engagementId);
  }, [engagementId]);

  if (isLoading && !currentEngagement) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <PageSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load engagement</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-hbird-600 text-sm hover:underline"
          >
            ← Back to engagements
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar engagementId={engagementId} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
