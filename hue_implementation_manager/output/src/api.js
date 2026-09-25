// Talks to the Express API (server.js + auth.js), which is a separate origin from the Vite dev
// server. `credentials: 'include'` is required on every call so the session cookie is sent/kept.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status})`, response.status);
  return body;
}

// Like request(), but for multipart form bodies (document upload/edit) -- no Content-Type header
// is set so the browser can add its own multipart boundary.
async function uploadRequest(path, formData, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    body: formData,
    ...options,
  });

  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status})`, response.status);
  return body;
}

// For GET endpoints that return a file rather than JSON (document download, questionnaire
// export) -- returns the blob plus the filename the server suggested via Content-Disposition.
async function downloadRequest(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error || `Download failed (${response.status})`, response.status);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob: await response.blob(), filename: match ? match[1] : 'download' };
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  getClients: () => request('/api/clients'),
  createClient: (fields) => request('/api/clients', { method: 'POST', body: JSON.stringify(fields) }),
  getClient: (id) => request(`/api/clients/${id}`),
  updateClient: (id, patch) => request(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updateBroker: (id, patch) => request(`/api/brokers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getBrokers: () => request('/api/brokers'),
  createBroker: (fields) => request('/api/brokers', { method: 'POST', body: JSON.stringify(fields) }),
  addClientContact: (clientId, contact) =>
    request(`/api/clients/${clientId}/contacts`, { method: 'POST', body: JSON.stringify(contact) }),
  updateClientContact: (clientId, contactId, patch) =>
    request(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeClientContact: (clientId, contactId) =>
    request(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' }),
  addClientDeliverable: (clientId, fields) =>
    request(`/api/clients/${clientId}/deliverables`, { method: 'POST', body: JSON.stringify(fields) }),
  updateClientDeliverable: (clientId, deliverableId, patch) =>
    request(`/api/clients/${clientId}/deliverables/${deliverableId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeClientDeliverable: (clientId, deliverableId) =>
    request(`/api/clients/${clientId}/deliverables/${deliverableId}`, { method: 'DELETE' }),
  addClientExpectation: (clientId, fields) =>
    request(`/api/clients/${clientId}/expectations`, { method: 'POST', body: JSON.stringify(fields) }),
  updateClientExpectation: (clientId, expectationId, patch) =>
    request(`/api/clients/${clientId}/expectations/${expectationId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeClientExpectation: (clientId, expectationId) =>
    request(`/api/clients/${clientId}/expectations/${expectationId}`, { method: 'DELETE' }),
  addClientDocument: (clientId, formData) =>
    uploadRequest(`/api/clients/${clientId}/documents`, formData, { method: 'POST' }),
  updateClientDocument: (clientId, docId, formData) =>
    uploadRequest(`/api/clients/${clientId}/documents/${docId}`, formData, { method: 'PATCH' }),
  removeClientDocument: (clientId, docId) =>
    request(`/api/clients/${clientId}/documents/${docId}`, { method: 'DELETE' }),
  downloadClientDocument: (clientId, docId) => downloadRequest(`/api/clients/${clientId}/documents/${docId}/download`),
  downloadQuestionnaireExport: (clientId) => downloadRequest(`/api/clients/${clientId}/questionnaire-export`),
  getTemplateDeliverables: () => request('/api/template/deliverables'),
  addTemplateDeliverable: (fields) => request('/api/template/deliverables', { method: 'POST', body: JSON.stringify(fields) }),
  updateTemplateDeliverable: (id, patch) =>
    request(`/api/template/deliverables/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeTemplateDeliverable: (id) => request(`/api/template/deliverables/${id}`, { method: 'DELETE' }),
  reorderTemplateDeliverable: (id, direction) =>
    request(`/api/template/deliverables/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),
  getTemplateExpectations: () => request('/api/template/expectations'),
  addTemplateExpectation: (fields) => request('/api/template/expectations', { method: 'POST', body: JSON.stringify(fields) }),
  updateTemplateExpectation: (id, patch) =>
    request(`/api/template/expectations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeTemplateExpectation: (id) => request(`/api/template/expectations/${id}`, { method: 'DELETE' }),
  reorderTemplateExpectation: (id, direction) =>
    request(`/api/template/expectations/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),
  getContactPool: () => request('/api/contacts'),
  addPoolContact: (fields) => request('/api/contacts', { method: 'POST', body: JSON.stringify(fields) }),
  updatePoolContact: (id, patch) => request(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removePoolContact: (id) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
  attachClientContact: (clientId, contactId, signatory) =>
    request(`/api/clients/${clientId}/contacts`, { method: 'POST', body: JSON.stringify({ contactId, signatory }) }),
  createContactLogin: (clientId, contactId, credentials) =>
    request(`/api/clients/${clientId}/contacts/${contactId}/users`, { method: 'POST', body: JSON.stringify(credentials) }),
  updateContactLogin: (clientId, contactId, credentials) =>
    request(`/api/clients/${clientId}/contacts/${contactId}/users`, { method: 'PATCH', body: JSON.stringify(credentials) }),
  removeContactLogin: (clientId, contactId) =>
    request(`/api/clients/${clientId}/contacts/${contactId}/users`, { method: 'DELETE' }),
};

export { ApiError };
