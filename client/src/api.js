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

async function consumeSsePost(url, onProgress) {
  const res = await fetch(`${BASE}${url}?_t=${Date.now()}`, { method: 'POST' });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = '';
      let eventData = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }
      if (!eventType || !eventData) continue;
      const data = JSON.parse(eventData);
      if (eventType === 'progress') {
        onProgress?.(data.message);
      } else if (eventType === 'done') {
        result = data;
      } else if (eventType === 'error') {
        throw new Error(data.message || 'Request failed');
      }
    }
  }

  if (!result) throw new Error('Request failed');
  return result;
}

/**
 * Consume the /pull-all SSE stream. Unlike consumeSsePost, this forwards every
 * event type (progress / pulls-done / report-generating / done / error) to onEvent
 * as { eventType, data }, so the component can render stage-aware UI.
 * Resolves with the `done` payload ({ results, report, summary }).
 */
async function consumePullAllSse(onEvent) {
  const res = await fetch(`${BASE}/projects/pull-all?_t=${Date.now()}`, { method: 'POST' });
  if (!res.body) throw new Error('Streaming not supported');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = '';
      let eventData = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }
      if (!eventType || !eventData) continue;
      const data = JSON.parse(eventData);
      if (eventType === 'error') {
        throw new Error(data.message || 'Request failed');
      }
      if (eventType === 'done') {
        result = data;
      }
      onEvent?.({ eventType, data });
    }
  }

  if (!result) throw new Error('Request failed');
  return result;
}

export const api = {
  getProjects: (search, options = {}) =>
    request(`/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`, options),
  getProject: (id, options = {}) => request(`/projects/${id}`, options),
  cloneProject: (url) => request('/projects/clone', { method: 'POST', body: JSON.stringify({ url }) }),
  cancelClone: (url) => request('/projects/clone/cancel', { method: 'POST', body: JSON.stringify({ url }) }),
  pullProject: (id) => request(`/projects/${id}/pull`, { method: 'POST' }),
  pullAllProjects: (onEvent) => consumePullAllSse(onEvent),
  scanProjects: () => request('/projects/scan', { method: 'POST' }),
  updateProject: (id, description) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ description }) }),
  openProjectFolder: (id) => request(`/projects/${id}/open-folder`, { method: 'POST' }),
  runStartBat: (id) => request(`/projects/${id}/start-bat`, { method: 'POST' }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  deleteProjectPermanently: (id) => request(`/projects/${id}/permanent`, { method: 'DELETE' }),
  recloneProject: (id, onProgress) => consumeSsePost(`/projects/${id}/reclone`, onProgress),
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