const BASE = '/api';

async function request(url, options = {}) {
  const separator = url.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${url}${separator}_t=${Date.now()}`, {
    cache: 'no-store',
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
  getProjects: (search, options = {}) =>
    request(`/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`, options),
  getProject: (id, options = {}) => request(`/projects/${id}`, options),
  cloneProject: (url) => request('/projects/clone', { method: 'POST', body: JSON.stringify({ url }) }),
  pullProject: (id) => request(`/projects/${id}/pull`, { method: 'POST' }),
  scanProjects: () => request('/projects/scan', { method: 'POST' }),
  updateProject: (id, description) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ description }) }),
  getUpdates: (projectId, options = {}) => request(`/projects/${projectId}/updates`, options),
  deleteUpdate: (projectId, updateId) => request(`/projects/${projectId}/updates/${updateId}`, { method: 'DELETE' }),
  getStats: () => request('/stats'),
  getConfig: () => request('/config'),
  testAiConnection: () => request('/config/test-ai', { method: 'POST' }),
  updateConfig: (key, value) => request('/config', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  regenerateSummary: (id) => request(`/projects/${id}/regenerate-summary`, { method: 'POST' }),
  regenerateAllSummaries: () => request('/projects/regenerate-all-summaries', { method: 'POST' }),
  autoClassify: () => request('/projects/auto-classify', { method: 'POST' }),
  updateTags: (id, tags) => request(`/projects/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tags }) }),
  getTags: (options = {}) => request('/projects/tags', options),
  getProjectRelease: (id) => request(`/projects/${id}/release`).catch(() => null),
  getCallChainTopics: (projectId, options = {}) =>
    request(`/projects/${projectId}/call-chain-topics`, options),
  getCallChain: (projectId, query, options = {}) =>
    request(`/projects/${projectId}/call-chain?q=${encodeURIComponent(query)}`, options),
  getStudyGuide: (projectId, force, options = {}) =>
    request(`/projects/${projectId}/study-guide${force ? '?force=1' : ''}`, options),
  // Learn Studio
  getFileTree: (projectId) => request(`/projects/${projectId}/file-tree`),
  getFileContent: (projectId, filePath) => request(`/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`),
  analyzeFile: (projectId, filePath) => request(`/projects/${projectId}/analyze-file?path=${encodeURIComponent(filePath)}`),
  translateFile: (projectId, filePath) => request(`/projects/${projectId}/translate-file?path=${encodeURIComponent(filePath)}`),
  learnChat: (projectId, messages, fileContext, filePath) => request(`/projects/${projectId}/learn-chat`, { method: 'POST', body: JSON.stringify({ messages, fileContext, filePath }) }),
  getNotes: (projectId) => request(`/projects/${projectId}/notes`),
  deleteNote: (projectId, noteId) => request(`/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' }),
  updateNote: (projectId, noteId, data) => request(`/projects/${projectId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveNote: (projectId, title, content, filePath, tags) => request(`/projects/${projectId}/notes`, { method: 'POST', body: JSON.stringify({ title, content, filePath, tags: tags || [] }) }),
  // Cards
  getCards: (projectId, tag) => request(`/projects/${projectId}/cards${tag ? '?tag=' + encodeURIComponent(tag) : ''}`),
  createCard: (projectId, data) => request(`/projects/${projectId}/cards`, { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (projectId, cardId, data) => request(`/projects/${projectId}/cards/${cardId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCard: (projectId, cardId) => request(`/projects/${projectId}/cards/${cardId}`, { method: 'DELETE' }),
  reviewCard: (projectId, cardId, quality) => request(`/projects/${projectId}/cards/${cardId}/review`, { method: 'PUT', body: JSON.stringify({ quality }) }),
  // Prompt builder
  getOutline: (projectId, force) => request(`/projects/${projectId}/outline${force ? '?force=1' : ''}`),
  assemblePrompt: (projectId, data) => request(`/projects/${projectId}/assemble-prompt`, { method: 'POST', body: JSON.stringify(data) }),
  getPromptHistory: (projectId, opts) => {
    const qs = [];
    if (opts?.starred) qs.push('starred=1');
    if (opts?.all) qs.push('all=1');
    if (opts?.tag) qs.push('tag=' + encodeURIComponent(opts.tag));
    if (opts?.project) qs.push('project=' + encodeURIComponent(opts.project));
    return request('/projects/' + projectId + '/prompt-history' + (qs.length ? '?' + qs.join('&') : ''));
  },
  updatePromptHistory: (projectId, promptId, data) => request(`/projects/${projectId}/prompt-history/${promptId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePromptHistory: (projectId, promptId) => request(`/projects/${projectId}/prompt-history/${promptId}`, { method: 'DELETE' }),
  uploadPromptImage: (projectId, promptId, file) => {
    const fd = new FormData(); fd.append('image', file);
    return fetch(`/api/projects/${projectId}/prompt-history/${promptId}/upload`, { method: 'POST', body: fd }).then(r => r.json());
  },
  // Learn tags
  getLearnTags: (projectId) => request(`/projects/${projectId}/learn-tags`),
  // Chat history
  getChatHistory: (projectId) => request(`/projects/${projectId}/chat-history`),
  loadChatHistory: (projectId, chatId) => request(`/projects/${projectId}/chat-history/${chatId}`),
  saveChatHistory: (projectId, data) => request(`/projects/${projectId}/chat-history`, { method: 'POST', body: JSON.stringify(data) }),
  deleteChatHistory: (projectId, chatId) => request(`/projects/${projectId}/chat-history/${chatId}`, { method: 'DELETE' }),
};