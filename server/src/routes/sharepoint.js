/**
 * SharePoint routes — SHAREPOINT_STUB
 *
 * All endpoints return stub responses until Azure AD credentials are configured.
 * See server/src/services/sharepoint/graphClient.js for the Phase 3 implementation plan.
 */

const express = require('express');
const router  = express.Router({ mergeParams: true });
const { isConfigured } = require('../services/sharepoint/graphClient');
const asyncHandler     = require('../utils/asyncHandler');

function stubResponse(res) {
  return res.status(501).json({
    error:   'SharePoint integration not configured',
    message: 'Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET in your .env file to enable SharePoint features.',
    stub:    true,
  });
}

// GET /sharepoint/status
router.get('/status', (req, res) => {
  res.json({ configured: isConfigured(), stub: !isConfigured() });
});

// GET /engagements/:engagementId/sharepoint/files — Browse SharePoint file tree
router.get('/files', asyncHandler(async (req, res) => {
  if (!isConfigured()) return stubResponse(res);
  // PHASE 3: implement file tree browsing
  return stubResponse(res);
}));

// POST /engagements/:engagementId/sharepoint/connect — Step 2 of setup wizard
router.post('/connect', asyncHandler(async (req, res) => {
  if (!isConfigured()) return stubResponse(res);
  return stubResponse(res);
}));

// POST /engagements/:engagementId/sharepoint/write-back — Write a file to SharePoint
router.post('/write-back', asyncHandler(async (req, res) => {
  if (!isConfigured()) return stubResponse(res);
  return stubResponse(res);
}));

module.exports = router;
