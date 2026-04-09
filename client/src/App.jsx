import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import EngagementList  from './pages/EngagementList';
import EngagementShell from './pages/EngagementShell';
import NotFound        from './pages/NotFound';

// Module placeholders — replaced with real implementations in subsequent build steps
import InterviewStudio   from './components/InterviewStudio';
import ArtifactIngestion from './components/ArtifactIngestion';
import KnowledgeHub      from './components/KnowledgeHub';
import TaskTracker       from './components/TaskTracker';
import EngagementSetup   from './components/EngagementSetup';
import PendingApprovals  from './components/PendingApprovals';

export default function App() {
  return (
    <Routes>
      {/* Home — Engagement selection screen */}
      <Route path="/"  element={<EngagementList />} />
      <Route path="/engagements" element={<Navigate to="/" replace />} />

      {/* Engagement shell — wraps all engagement-scoped views */}
      <Route path="/engagements/:engagementId" element={<EngagementShell />}>
        {/* Default sub-route: redirect to Knowledge Hub */}
        <Route index element={<Navigate to="knowledge-hub" replace />} />

        <Route path="knowledge-hub"  element={<KnowledgeHub />} />
        <Route path="interview"      element={<InterviewStudio />} />
        <Route path="interview/:sessionId" element={<InterviewStudio />} />
        <Route path="artifacts"      element={<ArtifactIngestion />} />
        <Route path="tasks"          element={<TaskTracker />} />
        <Route path="approvals"      element={<PendingApprovals />} />
        <Route path="setup"          element={<EngagementSetup />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
