import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/constants';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear storage
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    return Promise.reject(error);
  }
);

// ============ AUTH API ============
export const authAPI = {
  sendOtp: (email) => api.post('/auth/send-otp', { email }, { timeout: 60000 }),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }, { timeout: 60000 }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  checkLocation: (data) => api.post('/auth/check-location', data),
  uploadPhoto: (formData) => api.post('/auth/profile/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ============ POSTS API ============
export const postsAPI = {
  getFeed: (page = 1) => api.get(`/posts?page=${page}`),
  getVideos: (page = 1) => api.get(`/posts/videos?page=${page}`),
  createPost: (formData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 minutes for video uploads
  }),
  likePost: (id) => api.post(`/posts/${id}/like`),
  getComments: (id, page = 1) => api.get(`/posts/${id}/comments?page=${page}`),
  addComment: (id, text) => api.post(`/posts/${id}/comments`, { text }),
  deletePost: (id) => api.delete(`/posts/${id}`),
};

// ============ LISTINGS API ============
export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params }),
  getOne: (id) => api.get(`/listings/${id}`),
  create: (formData) => api.post('/listings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  getMine: () => api.get('/listings/my/all'),
};

// ============ TOURNAMENTS API ============
export const tournamentsAPI = {
  getAll: (sport) => api.get(`/tournaments${sport ? `?sport=${sport}` : ''}`),
  getSports: () => api.get('/tournaments/sports'),
  getOne: (id) => api.get(`/tournaments/${id}`),
  create: (formData) => api.post('/tournaments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // JSON-based create (no image upload needed)
  createJSON: (data) => api.post('/tournaments', data),
  addMatch: (id, data) => api.post(`/tournaments/${id}/matches`, data),
  update: (id, data) => api.put(`/tournaments/${id}`, data),
  updateMatch: (matchId, data) => api.put(`/tournaments/matches/${matchId}`, data),
  delete: (id) => api.delete(`/tournaments/${id}`),
};

// ============ GOVT OFFICES API ============
export const govtOfficesAPI = {
  getAll: (search) => api.get(`/govt-offices${search ? `?search=${search}` : ''}`),
  getOne: (id) => api.get(`/govt-offices/${id}`),
  create: (data) => api.post('/govt-offices', data),
  update: (id, data) => api.put(`/govt-offices/${id}`, data),
  delete: (id) => api.delete(`/govt-offices/${id}`),
};

// ============ SHOPS API ============
export const shopsAPI = {
  search: (query) => api.get(`/shops?search=${query}`),
  getSuggestions: () => api.get('/shops/suggestions'),
  getOne: (id) => api.get(`/shops/${id}`),
  create: (data) => api.post('/shops', data),
  update: (id, data) => api.put(`/shops/${id}`, data),
  delete: (id) => api.delete(`/shops/${id}`),
};

// ============ RISHTA API ============
export const rishtaAPI = {
  getAgreement: () => api.get('/rishta/agreement'),
  getMyProfile: () => api.get('/rishta/my-profile'),
  apply: (formData) => api.post('/rishta/apply', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadPhotos: (formData) => api.post('/rishta/upload-photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getProfiles: (params) => api.get('/rishta/profiles', { params }),
  sendInterest: (profileId) => api.post(`/rishta/interest/${profileId}`),
  getInterests: () => api.get('/rishta/interests'),
  getSentInterests: () => api.get('/rishta/sent-interests'),
  acceptInterest: (interestId) => api.put(`/rishta/interest/${interestId}/accept`),
  rejectInterest: (interestId) => api.put(`/rishta/interest/${interestId}/reject`),
  shortlist: (profileId) => api.post(`/rishta/shortlist/${profileId}`),
  getShortlisted: () => api.get('/rishta/shortlisted'),
};

// ============ NEWS API ============
export const newsAPI = {
  getAll: (params) => api.get('/news', { params }),
  getCategories: () => api.get('/news/categories'),
  getOne: (id) => api.get(`/news/${id}`),
  create: (formData) => api.post('/news', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/news/${id}`),
};

// ============ NOTIFICATIONS API ============
export const notificationsAPI = {
  getAll: (page = 1) => api.get(`/notifications?page=${page}`),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ============ CHAT API ============
export const chatAPI = {
  getMessages: (page = 1) => api.get(`/chat/messages?page=${page}`),
  sendMessage: (data) => api.post('/chat/messages', {
    text: data.text || null,
    images: data.images || [],
    videos: [],
    voiceUrl: data.voiceUrl || null,
    voiceDuration: data.voiceDuration || null,
    replyToId: data.replyToId || null,
  }),
  uploadVoice: (data) => api.post('/chat/voice', data),
  getUserProfile: (userId) => api.get(`/chat/user/${userId}`),
  reactToMessage: (msgId, emoji) => api.post(`/chat/messages/${msgId}/react`, { emoji }),
  reportMessage: (data) => api.post('/chat/report', data),
};

// ============ CHATBOT API ============
export const chatbotAPI = {
  sendMessage: (message) => api.post('/chatbot/message', { message }),
};

// ============ DM API ============
export const dmAPI = {
  startChat: (userId, source) => api.post(`/dm/start/${userId}`, { source }),
  getChats: () => api.get('/dm/chats'),
  getMessages: (chatId, page = 1) => api.get(`/dm/${chatId}/messages?page=${page}`),
  sendMessage: (chatId, data) => api.post(`/dm/${chatId}/messages`, data),
  uploadImages: (chatId, formData) => api.post(`/dm/${chatId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  blockUser: (chatId) => api.post(`/dm/${chatId}/block`),
  unblockUser: (chatId) => api.post(`/dm/${chatId}/unblock`),
  report: (chatId, data) => api.post(`/dm/${chatId}/report`, data),
};

// ============ BLOOD DONATION API ============
export const bloodAPI = {
  getDonors: (params) => api.get('/blood/donors', { params }),
  getGroups: () => api.get('/blood/groups'),
  getMyDonation: () => api.get('/blood/my-donation'),
  register: (data) => api.post('/blood/register', data),
  update: (data) => api.put('/blood/update', data),
  unregister: () => api.delete('/blood/unregister'),
};

// ============ ADMIN API ============
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.put(`/admin/users/${id}/toggle-active`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getPendingRishta: () => api.get('/admin/rishta/pending'),
  approveRishta: (id) => api.put(`/admin/rishta/${id}/approve`),
  rejectRishta: (id, reason) => api.put(`/admin/rishta/${id}/reject`, { reason }),
  getReporters: () => api.get('/admin/reporters'),
  addReporter: (data) => api.post('/admin/reporters', data),
  toggleReporter: (id) => api.put(`/admin/reporters/${id}/toggle-active`),
  deleteReporter: (id) => api.delete(`/admin/reporters/${id}`),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  deleteListing: (id) => api.delete(`/admin/listings/${id}`),
  deleteComment: (id) => api.delete(`/admin/comments/${id}`),
  deleteChatMessage: (id) => api.delete(`/admin/chat-messages/${id}`),
  deleteNews: (id) => api.delete(`/admin/news/${id}`),
  deleteTournament: (id) => api.delete(`/admin/tournaments/${id}`),
  // Bulk cleanup
  bulkDeleteChat: (data) => api.delete('/admin/chat-messages-bulk', { data }),
  bulkDeleteNotifications: (data) => api.delete('/admin/notifications-bulk', { data }),
  // Storage / DB info
  getStorage: () => api.get('/admin/storage'),
  getDbStatus: () => api.get('/db-status'),
  // Cleanup old records
  cleanup: (target, olderThanDays = 30) => api.post('/admin/cleanup', { target, olderThanDays }),
};

// ============ REPORTS API ============
export const reportsAPI = {
  getAll: (params) => api.get('/reports', { params }),
  takeAction: (id, action) => api.put(`/reports/${id}/action`, { action }),
};

// ============ DOCTORS API ============
export const doctorsAPI = {
  getAll: (params) => api.get('/doctors', { params }),
  getSpecialties: () => api.get('/doctors/specialties'),
  getOne: (id) => api.get(`/doctors/${id}`),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
};

// ============ JOBS API ============
export const jobsAPI = {
  getAll: (params) => api.get('/jobs', { params }),
  getCategories: () => api.get('/jobs/categories'),
  getOne: (id) => api.get(`/jobs/${id}`),
  getMine: () => api.get('/jobs/my'),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  delete: (id) => api.delete(`/jobs/${id}`),
  apply: (id, data) => api.post(`/jobs/${id}/apply`, data),
  getApplications: (id) => api.get(`/jobs/${id}/applications`),
};

// ============ ALIASES FOR BACKWARDS COMPATIBILITY ============
export const listingAPI = listingsAPI;
export const tournamentAPI = tournamentsAPI;

export default api;
