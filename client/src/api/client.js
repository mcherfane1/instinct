/**
 * API client — all server calls go through here.
 * Base URL is always /api (proxied by Vite dev server to port 4000).
 * Production: same-origin — no CORS issues.
 * NEVER import @anthropic-ai/sdk or any AI SDK on the client side.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach role header for local dev role switching
api.interceptors.request.use(config => {
  const role = localStorage.getItem('dev_role');
  if (role) config.headers['X-User-Role'] = role;
  return config;
});

// Response interceptor — unwrap data, normalize errors
api.interceptors.response.use(
  response => response,
  error => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    const enhanced = new Error(message);
    enhanced.status  = error.response?.status;
    enhanced.data    = error.response?.data;
    enhanced.isAxios = true;
    return Promise.reject(enhanced);
  }
);

// ── Engagement API ────────────────────────────────────────────────────────────
export const engagementApi = {
  list:         ()          => api.get('/engagements'),
  get:          id          => api.get(`/engagements/${id}`),
  create:       data        => api.post('/engagements', data),
  update:       (id, data)  => api.put(`/engagements/${id}`, data),
  stats:        id          => api.get(`/engagements/${id}/stats`),
};

// ── Session API ───────────────────────────────────────────────────────────────
export const sessionApi = {
  list:    eId            => api.get(`/engagements/${eId}/sessions`),
  get:     (eId, sId)     => api.get(`/engagements/${eId}/sessions/${sId}`),
  create:  (eId, data)    => api.post(`/engagements/${eId}/sessions`, data),
  save:    (eId, sId, d)  => api.put(`/engagements/${eId}/sessions/${sId}`, d),
  close:   (eId, sId)     => api.post(`/engagements/${eId}/sessions/${sId}/close`),
};

// ── Findings API ──────────────────────────────────────────────────────────────
export const findingApi = {
  list:         (eId, params)  => api.get(`/engagements/${eId}/findings`, { params }),
  get:          (eId, fId)     => api.get(`/engagements/${eId}/findings/${fId}`),
  create:       (eId, data)    => api.post(`/engagements/${eId}/findings`, data),
  update:       (eId, fId, d)  => api.put(`/engagements/${eId}/findings/${fId}`, d),
  confirm:      (eId, fId)     => api.post(`/engagements/${eId}/findings/${fId}/confirm`),
  promoteNote:  (eId, data)    => api.post(`/engagements/${eId}/findings/promote-note`, data),
};

// ── Questions API ─────────────────────────────────────────────────────────────
export const questionApi = {
  list:    (eId, params) => api.get(`/engagements/${eId}/questions`, { params }),
  get:     (eId, qId)    => api.get(`/engagements/${eId}/questions/${qId}`),
  create:  (eId, data)   => api.post(`/engagements/${eId}/questions`, data),
  update:  (eId, qId, d) => api.put(`/engagements/${eId}/questions/${qId}`, d),
  bulk:    (eId, qs)     => api.post(`/engagements/${eId}/questions/bulk`, { questions: qs }),
};

// ── Stakeholders API ──────────────────────────────────────────────────────────
export const stakeholderApi = {
  list:   (eId, params) => api.get(`/engagements/${eId}/stakeholders`, { params }),
  get:    (eId, sId)    => api.get(`/engagements/${eId}/stakeholders/${sId}`),
  create: (eId, data)   => api.post(`/engagements/${eId}/stakeholders`, data),
  update: (eId, sId, d) => api.put(`/engagements/${eId}/stakeholders/${sId}`, d),
};

// ── Artifacts API ─────────────────────────────────────────────────────────────
export const artifactApi = {
  list:      (eId, params)      => api.get(`/engagements/${eId}/artifacts`, { params }),
  get:       (eId, aId)         => api.get(`/engagements/${eId}/artifacts/${aId}`),
  upload:    (eId, formData)    => api.post(`/engagements/${eId}/artifacts/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min for large files
  }),
  update:    (eId, aId, data)   => api.put(`/engagements/${eId}/artifacts/${aId}`, data),
  reprocess: (eId, aId)         => api.post(`/engagements/${eId}/artifacts/${aId}/reprocess`),
};

// ── Assumptions & Gaps API ────────────────────────────────────────────────────
export const assumptionApi = {
  list:   (eId, params) => api.get(`/engagements/${eId}/assumptions`, { params }),
  create: (eId, data)   => api.post(`/engagements/${eId}/assumptions`, data),
  update: (eId, id, d)  => api.put(`/engagements/${eId}/assumptions/${id}`, d),
};

// ── Decisions & Actions API ───────────────────────────────────────────────────
export const decisionApi = {
  list:    (eId, params) => api.get(`/engagements/${eId}/decisions`, { params }),
  create:  (eId, data)   => api.post(`/engagements/${eId}/decisions`, data),
  update:  (eId, id, d)  => api.put(`/engagements/${eId}/decisions/${id}`, d),
  confirm: (eId, id)     => api.post(`/engagements/${eId}/decisions/${id}/confirm`),
};

// ── Metadata / Pending Approvals API ─────────────────────────────────────────
export const metadataApi = {
  suggestions: (eId, params) => api.get(`/engagements/${eId}/metadata/suggestions`, { params }),
  count:       eId           => api.get(`/engagements/${eId}/metadata/suggestions/count`),
  approve:     (eId, sId)    => api.post(`/engagements/${eId}/metadata/suggestions/${sId}/approve`),
  deny:        (eId, sId)    => api.post(`/engagements/${eId}/metadata/suggestions/${sId}/deny`),
  assign:      (eId, sId, v) => api.post(`/engagements/${eId}/metadata/suggestions/${sId}/assign`, { assigned_value: v }),
};

// ── AI API ────────────────────────────────────────────────────────────────────
export const aiApi = {
  status:           ()            => api.get('/ai/status'),
  knowledgeQuery:   (eId, query)  => api.post(`/engagements/${eId}/ai/knowledge-hub/query`, { query }),
  sessionReview:    (eId, data)   => api.post(`/engagements/${eId}/ai/session-review`, data),
  sowAnalysis:      (eId, text)   => api.post(`/engagements/${eId}/ai/sow-analysis`, { sowText: text }),
  generateQuestions:(eId)         => api.post(`/engagements/${eId}/ai/generate-questions`),
};

// ── Export API ────────────────────────────────────────────────────────────────
export const exportApi = {
  excel:   eId              => api.get(`/engagements/${eId}/export/excel`, { responseType: 'blob' }),
  kbJson:  eId              => api.get(`/engagements/${eId}/export/kb.json`, { responseType: 'blob' }),
  session: (eId, sId, fmt)  => api.get(`/engagements/${eId}/export/session/${sId}?format=${fmt}`, { responseType: 'blob' }),
};

// ── SharePoint API ────────────────────────────────────────────────────────────
export const sharepointApi = {
  status: () => api.get('/sharepoint/status'),
};

export default api;
