const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getProjects: (search) => request(`/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getProject: (id) => request(`/projects/${id}`),
  cloneProject: (url) => request('/projects/clone', { method: 'POST', body: JSON.stringify({ url }) }),
  pullProject: (id) => request(`/projects/${id}/pull`, { method: 'POST' }),
  scanProjects: () => request('/projects/scan', { method: 'POST' }),
  updateProject: (id, description) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ description }) }),
  getUpdates: (projectId) => request(`/projects/${projectId}/updates`),
  getStats: () => request('/stats'),
  getConfig: () => request('/config'),
  updateConfig: (key, value) => request('/config', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  regenerateSummary: (id) => request(`/projects/${id}/regenerate-summary`, { method: 'POST' }),
  regenerateAllSummaries: () => request('/projects/regenerate-all-summaries', { method: 'POST' }),
  autoClassify: () => request('/projects/auto-classify', { method: 'POST' }),
  updateCategory: (id, category) => request(`/projects/${id}/category`, { method: 'PUT', body: JSON.stringify({ category }) }),
  getCategories: () => request('/projects/categories'),
};
