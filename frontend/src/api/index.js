import api, { apiUrl } from './client';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data)
};

export const clipApi = {
  list: (params) => api.get('/clips', { params }),
  get: (id) => api.get(`/clips/${id}`),
  create: (data) => api.post('/clips', data),
  update: (id, data) => api.put(`/clips/${id}`, data),
  remove: (id) => api.delete(`/clips/${id}`),
  toggleFavorite: (id) => api.post(`/clips/${id}/toggle-favorite`),
  recordRead: (id) => api.post(`/clips/${id}/read`),
  generateSummary: (id) => api.post(`/clips/${id}/summary`),
  checkDuplicate: (url) => api.get('/clips/duplicate', { params: { url } })
};

export const tagApi = {
  list: () => api.get('/tags'),
  create: (name) => api.post('/tags', { name }),
  remove: (name) => api.delete(`/tags/${encodeURIComponent(name)}`),
  recommend: (data) => api.post('/tags/recommend', data)
};

export const notebookApi = {
  list: () => api.get('/notebooks'),
  create: (data) => api.post('/notebooks', data),
  update: (id, data) => api.put(`/notebooks/${id}`, data),
  remove: (id, params) => api.delete(`/notebooks/${id}`, { params })
};

export const shareApi = {
  list: () => api.get('/shares/manage'),
  create: (data) => api.post('/shares/manage', data),
  remove: (id) => api.delete(`/shares/manage/${id}`),
  toggle: (id) => api.post(`/shares/manage/${id}/toggle`),
  getPublic: (code) => api.get(`/shares/public/${code}`)
};

export const statsApi = {
  get: () => api.get('/stats')
};

export const recycleApi = {
  list: () => api.get('/recycle'),
  restore: (ids) => api.post('/recycle/restore', { ids }),
  purge: (ids) => api.post('/recycle/purge', { ids }),
  purgeAll: () => api.post('/recycle/purge-all')
};

export const batchApi = {
  edit: (ids, data) => api.post('/batch/edit', { ids, data }),
  remove: (ids) => api.post('/batch/delete', { ids }),
  favorite: (ids, isFavorite) => api.post('/batch/favorite', { ids, isFavorite })
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data)
};

export const uploadApi = {
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const extractApi = {
  extract: (url) => api.post('/extract', { url })
};

export const exportApi = {
  markdownUrl: (id) => apiUrl(`/export/${id}/markdown`),
  pdfUrl: (id) => apiUrl(`/export/${id}/pdf`),
  viewMarkdown: (id) => api.get(`/export/${id}/view-markdown`, { responseType: 'text' })
};

export const knowledgeApi = {
  stats: () => api.get('/knowledge/stats')
};

export const ragApi = {
  status: () => api.get('/rag/status'),
  ask: (question) => api.post('/rag/ask', { question })
};
