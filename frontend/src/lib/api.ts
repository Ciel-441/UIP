import axios from 'axios';

const api = axios.create({
  baseURL: typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '') : '',
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    const roomId = localStorage.getItem('active_room_id');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (roomId) {
      config.headers['X-Room-Id'] = roomId;
    }
    if (config.method?.toLowerCase() === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Only redirect to login if the /me check failed (token truly expired)
      // Don't redirect for other 401s — let the page handle them
      if (url.includes('/api/auth/me') && typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        // Don't redirect if already on login/register
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/api/auth/register', data),
  login: (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  verify: (token: string) => api.get(`/api/auth/verify?token=${token}`),
  me: () => api.get('/api/auth/me'),
  online: () => api.get('/api/auth/online'),
  users: () => api.get('/api/auth/users'),
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) => api.post('/api/auth/reset-password', { token, new_password }),
  logout: () => api.post('/api/auth/logout'),
};

// Rooms
export const roomApi = {
  create: (data: { name: string; description?: string }) => api.post('/api/rooms', data),
  list: () => api.get('/api/rooms'),
  listPending: () => api.get('/api/rooms/pending'),
  setActive: (id: number) => api.put(`/api/rooms/active/${id}`),
  join: (data: { invite_code?: string }) => api.post('/api/rooms/join', data),
  
  // Admin routes (rely on X-Room-Id interceptor)
  generateInvite: (data: { expires_hours: number; max_uses: number }) => api.post('/api/rooms/invites', data),
  listInvites: () => api.get('/api/rooms/invites'),
  revokeInvite: (invite_id: number) => api.delete(`/api/rooms/invites/${invite_id}`),
  
  listRequests: () => api.get('/api/rooms/requests'),
  approveMember: (membership_id: number) => api.post(`/api/rooms/requests/${membership_id}/approve`),
  rejectMember: (membership_id: number) => api.post(`/api/rooms/requests/${membership_id}/reject`),
  
  listMembers: () => api.get('/api/rooms/members'),
  addMember: (data: { user_id: number; role?: string }) => api.post('/api/rooms/members', data),
  updateMemberRole: (membership_id: number, data: { role: string }) => api.put(`/api/rooms/members/${membership_id}/role`, data),
  removeMember: (membership_id: number) => api.delete(`/api/rooms/members/${membership_id}`),
  
  info: () => api.get('/api/rooms/info'),
  delete: (room_id: number) => api.delete(`/api/rooms/${room_id}`),
  leave: (room_id: number) => api.post(`/api/rooms/${room_id}/leave`),
};

// Entities
export const entityApi = {
  list: (params?: { type?: string; search?: string; limit?: number; offset?: number }) =>
    api.get('/api/entities', { params }),
  create: (data: { name: string; type: string; description: string; properties: Record<string, any> }) =>
    api.post('/api/entities', data),
  get: (id: string) => api.get(`/api/entities/${id}`),
  update: (id: string, data: { name: string; type: string; description: string; properties: Record<string, any> }) =>
    api.put(`/api/entities/${id}`, data),
  delete: (id: string) => api.delete(`/api/entities/${id}`),
  getDuplicates: (threshold: number = 0.8) => 
    api.get('/api/entities/tools/duplicates', { params: { threshold } }),
  merge: (target_id: string, source_id: string) => 
    api.post('/api/entities/tools/merge', { target_id, source_id }),
};

// Relationships
export const relationshipApi = {
  list: (params?: { source_id?: string; target_id?: string; type?: string; limit?: number; offset?: number }) =>
    api.get('/api/relationships', { params }),
  create: (data: { type: string; source_id: string; target_id: string; description: string }) =>
    api.post('/api/relationships', data),
  delete: (id: string) => api.delete(`/api/relationships/${id}`),
  autoLink: () => api.post('/api/relationships/auto-link'),
};

// Documents
export const documentApi = {
  list: () => api.get('/api/documents'),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: (id: number) => api.get(`/api/documents/${id}`),
  extract: (id: number) => api.post(`/api/documents/${id}/extract`),
  confirm: (id: number, data: { entities: any[]; relationships: any[] }) =>
    api.post(`/api/documents/${id}/confirm`, data),
  reset: (id: number) => api.post(`/api/documents/${id}/reset`),
  delete: (id: number) => api.delete(`/api/documents/${id}`),
};

// Search
export const searchApi = {
  search: (params: { q: string; type?: string }) =>
    api.get('/api/search', { params }),
};

// AI
export const aiApi = {
  query: (question: string) => api.post('/api/ai/query', { question }),
  status: () => api.get('/api/ai/status'),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/api/dashboard/stats', { params: { _t: Date.now() } }),
  recentActivity: (limit?: number) =>
    api.get('/api/dashboard/recent-activity', { params: { limit, _t: Date.now() } }),
  growth: () => api.get('/api/dashboard/growth', { params: { _t: Date.now() } }),
  auditLogs: (params?: { user_id?: number; limit?: number; offset?: number }) =>
    api.get('/api/dashboard/audit-logs', { params }),
  contributionStats: () => api.get('/api/dashboard/contribution-stats', { params: { _t: Date.now() } }),
};

// Analytics
export const analyticsApi = {
  entityGrowth: () => api.get('/api/analytics/entity-growth'),
  mostConnected: (limit?: number) =>
    api.get('/api/analytics/most-connected', { params: { limit } }),
  mostReferenced: (limit?: number) =>
    api.get('/api/analytics/most-referenced', { params: { limit } }),
  recommendations: () => api.get('/api/analytics/recommendations'),
  knowledgeGaps: (limit?: number) => 
    api.get('/api/analytics/knowledge-gaps', { params: { limit } }),
};

// Settings
export const settingsApi = {
  get: () => api.get('/api/settings'),
  update: (key: string, value: string) =>
    api.put('/api/settings', { key, value }),
  clearGraph: () => api.delete('/api/settings/clear-graph'),
  getBackupStatus: () => api.get('/api/settings/graph-backup-status'),
  undoClearGraph: () => api.post('/api/settings/undo-clear-graph'),
};

// Profile
export const profileApi = {
  get: () => api.get('/api/profile'),
  getAllUsers: () => api.get('/api/profile/all'),
  getOther: (userId: number) => api.get(`/api/profile/${userId}`),
  update: (data: { nickname?: string; gender?: string; dob?: string; bio?: string; position?: string; pfp_url?: string; read_receipts_enabled?: boolean }) => 
    api.put('/api/profile', data),
  uploadPfp: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
    const baseUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '') : '';
    const res = await fetch(`${baseUrl}/api/profile/upload-pfp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return { data };
  },
};

// Communication
export const communicationApi = {
  getConversations: () => api.get('/api/communication/conversations'),
  createDirectConversation: (target_user_id: number) => api.post('/api/communication/conversations/direct', { target_user_id }),
  createGroup: (name: string, member_ids: number[]) => api.post('/api/communication/conversations/group', { name, member_ids }),
  updateGroupProfile: (conversationId: number, data: { name?: string; bio?: string; pfp_url?: string }) => api.put(`/api/communication/conversations/group/${conversationId}/profile`, data),
  addGroupMembers: (conversationId: number, member_ids: number[]) => api.post(`/api/communication/conversations/group/${conversationId}/members`, { member_ids }),
  removeGroupMember: (conversationId: number, user_id: number) => api.delete(`/api/communication/conversations/group/${conversationId}/members/${user_id}`),
  updateMemberRole: (conversationId: number, user_id: number, role: string) => api.put(`/api/communication/conversations/group/${conversationId}/members/${user_id}/role`, { role }),
  muteGroupMember: (conversationId: number, user_id: number, is_server_muted: boolean) => api.put(`/api/communication/conversations/group/${conversationId}/members/${user_id}/mute`, { is_server_muted }),
  deleteGroup: (conversationId: number) => api.delete(`/api/communication/conversations/group/${conversationId}`),
  updateChatState: (conversationId: number, data: { is_pinned?: boolean, is_hidden?: boolean, is_local_muted?: boolean, last_read_message_id?: number }) => api.put(`/api/communication/conversations/${conversationId}/state`, data),
  getMessages: (conversationId: number) => api.get(`/api/communication/conversations/${conversationId}/messages`),
  clearDMHistory: (conversationId: number) => api.delete(`/api/communication/conversations/dm/${conversationId}`),
  getMessageReadBy: (messageId: number) => api.get(`/api/communication/messages/${messageId}/read_by`),
  getNotifications: () => api.get('/api/communication/notifications'),
  markNotificationsRead: () => api.post('/api/communication/notifications/read'),
  blockUser: (userId: number) => api.post(`/api/profile/block/${userId}`),
  unblockUser: (userId: number) => api.delete(`/api/profile/block/${userId}`),
  // WebSockets are handled directly via native WebSocket API
};

// Extraction Rules
export const extractionRulesApi = {
  get: () => api.get('/api/extraction-rules'),
  create: (data: { rule_text: string; domain?: string }) => api.post('/api/extraction-rules', data),
  delete: (id: number) => api.delete(`/api/extraction-rules/${id}`),
};

// Digital Twins
export const twinsApi = {
  list: (params?: any) => api.get('/api/digital-twins', { params }),
  create: (data: { name: string; description: string; domain: string; parameters: any }) => api.post('/api/digital-twins', data),
  createScenario: (twinId: number, data: { title: string; description: string; parameters: any }) => api.post(`/api/digital-twins/${twinId}/scenarios`, data),
  simulate: (twinId: number, scenarioId: number) => api.post(`/api/digital-twins/${twinId}/simulate/${scenarioId}`),
  optimize: (twinId: number, data: { goal: string; num_strategies?: number }) => api.post(`/api/digital-twins/${twinId}/optimize`, data),
  plan: (twinId: number, strategy: any) => api.post(`/api/digital-twins/${twinId}/plan`, { strategy }),
};

// Predictive Analytics
export const predictiveApi = {
  getRisks: () => api.get('/api/predictive/risks'),
  getForecasts: () => api.get('/api/predictive/forecasts'),
  getStrategies: () => api.get('/api/predictive/strategies'),
};

export default api;
