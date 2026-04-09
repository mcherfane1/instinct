/**
 * Microsoft Graph API client — SHAREPOINT_STUB
 *
 * All functions in this file return stub responses until Azure AD credentials
 * are configured (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET).
 *
 * Phase 3 implementation checklist:
 *   1. Install: npm install @azure/identity @microsoft/microsoft-graph-client
 *   2. Replace getClient() with real ClientSecretCredential + GraphServiceClient
 *   3. Implement each stubbed function using the Graph SDK
 *   4. Wire up change notification webhooks (watchScope.js)
 *   5. Update Setup Step 2 to use the real folder picker
 *
 * Required Graph API permissions (PRD §9.5):
 *   Sites.ReadWrite.All  (Delegated)
 *   Files.ReadWrite.All  (Delegated)
 *   Files.Read.All       (Application)
 *   Sites.Manage.All     (Delegated)
 *   User.Read            (Delegated)
 *   offline_access       (Delegated)
 */

const STUB_WARNING = '[SharePoint] SHAREPOINT_STUB — Graph API not connected. Configure Azure AD credentials.';

function isConfigured() {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  );
}

function checkConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      'SharePoint integration is not configured. ' +
      'Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET in your .env file.'
    );
    err.status = 501;
    throw err;
  }
}

// PHASE 3: Replace with real Graph client initialization
// function getClient(accessToken) {
//   const authProvider = { getAccessToken: async () => accessToken };
//   return Client.initWithMiddleware({ authProvider });
// }

async function listSiteFiles(siteUrl, folderId) {
  console.warn(STUB_WARNING);
  checkConfigured();
  // PHASE 3: return graphClient.api(`/sites/${siteId}/drives/${driveId}/items/${folderId}/children`).get()
  return { value: [], stub: true };
}

async function downloadFile(siteUrl, itemId) {
  console.warn(STUB_WARNING);
  checkConfigured();
  // PHASE 3: return graphClient.api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/content`).getStream()
  return null;
}

async function uploadFile(siteUrl, folderId, fileName, content) {
  console.warn(STUB_WARNING);
  checkConfigured();
  // PHASE 3: return graphClient.api(`/sites/${siteId}/drives/${driveId}/items/${folderId}:/${fileName}:/content`).put(content)
  return { id: 'stub-item-id', stub: true };
}

async function createFolder(siteUrl, parentFolderId, folderName) {
  console.warn(STUB_WARNING);
  checkConfigured();
  return { id: 'stub-folder-id', name: folderName, stub: true };
}

async function subscribeToChanges(siteUrl, folderId, notificationUrl) {
  console.warn(STUB_WARNING);
  checkConfigured();
  // PHASE 3: POST to /subscriptions with resource and notificationUrl
  return { subscriptionId: 'stub-subscription-id', stub: true };
}

async function updateFileMetadata(siteUrl, itemId, columnValues) {
  console.warn(STUB_WARNING);
  checkConfigured();
  // PHASE 3: PATCH /sites/{id}/lists/{id}/items/{id}/fields
  return { stub: true };
}

module.exports = {
  isConfigured,
  listSiteFiles,
  downloadFile,
  uploadFile,
  createFolder,
  subscribeToChanges,
  updateFileMetadata,
};
