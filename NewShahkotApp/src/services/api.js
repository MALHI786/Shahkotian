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
  register: (data) => api.post('/auth/register', data, { timeout: 60000 }),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data, { timeout: 60000 }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  checkLocation: (data) => api.post('/auth/check-location', data),
  uploadPhoto: (formData) => api.post('/auth/profile/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ============ LISTINGS API ============
export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params }),
  getOne: (id) => api.get(`/listings/${id}`),
  create: (formData) => api.post('/listings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
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
  deleteProfile: () => api.delete('/rishta/my-profile'),
};

// ============ NEWS API ============
export const newsAPI = {
  getAll: (params) => api.get('/news', { params }),
  getCategories: () => api.get('/news/categories'),
  getOne: (id) => api.get(`/news/${id}`),
  create: (formData) => api.post('/news', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  }),
  delete: (id) => api.delete(`/news/${id}`),
};

// ============ NOTIFICATIONS API ============
export const notificationsAPI = {
  getAll: (page = 1) => api.get(`/notifications?page=${page}`),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  saveFcmToken: (token) => api.put('/notifications/fcm-token', { token }),
  removeFcmToken: () => api.delete('/notifications/fcm-token'),
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
  deleteMessage: (msgId) => api.delete(`/chat/messages/${msgId}`),
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
  deleteListing: (id) => api.delete(`/admin/listings/${id}`),
  deleteChatMessage: (id) => api.delete(`/admin/chat-messages/${id}`),
  deleteNews: (id) => api.delete(`/admin/news/${id}`),
  deleteTournament: (id) => api.delete(`/admin/tournaments/${id}`),
  // Bulk cleanup
  bulkDeleteChat: (data) => api.delete('/admin/chat-messages-bulk', { data }),
  bulkDeleteNotifications: (data) => api.delete('/admin/notifications-bulk', { data }),
  // Storage / DB info
  getStorage: () => api.get('/admin/storage'),
  getDbStatus: () => api.get('/db-status'),
  getCloudinaryStatus: () => api.get('/cloudinary-status'),
  switchCloudinary: (index) => api.post('/cloudinary-switch', { index }),
  switchDatabase: (index) => api.post('/db-switch', { index }),
  // Cleanup old records
  cleanup: (target, olderThanDays = 30) => api.post('/admin/cleanup', { target, olderThanDays }),
  // Push notifications
  sendNotification: (data) => api.post('/admin/send-notification', data),
  getNotificationStats: () => api.get('/admin/notification-stats'),
};

// ============ REPORTS API ============
export const reportsAPI = {
  getAll: (params) => api.get('/reports', { params }),
  takeAction: (id, action) => api.put(`/reports/${id}/action`, { action }),
  // Submit a content report (posts, listings, users, etc.)
  submit: (data) => api.post('/reports', data), // { targetType, targetId, targetUserId, reason }
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

// ============ RESTAURANTS & DEALS API ============
export const restaurantsAPI = {
  getAll: (params) => api.get('/restaurants', { params }),
  getOne: (id) => api.get(`/restaurants/${id}`),
  getAllDeals: () => api.get('/restaurants/deals/all'),
  // Admin
  adminCreate: (formData) => api.post('/restaurants/admin/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  adminUpdate: (id, data) => api.put(`/restaurants/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/restaurants/admin/${id}`),
  // Restaurant owner auth (uses separate token stored per session)
  ownerLogin: (data) => api.post('/restaurants/auth/login', data),
  ownerProfile: (token) => api.get('/restaurants/owner/profile', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  ownerCreateDeal: (token, formData) => api.post('/restaurants/owner/deals', formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
  }),
  ownerUpdateDeal: (token, dealId, data) => api.put(`/restaurants/owner/deals/${dealId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  ownerDeleteDeal: (token, dealId) => api.delete(`/restaurants/owner/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

// ============ CLOTH BRANDS & DEALS API ============
export const clothBrandsAPI = {
  getAll: (params) => api.get('/cloth-brands', { params }),
  getOne: (id) => api.get(`/cloth-brands/${id}`),
  getAllDeals: () => api.get('/cloth-brands/deals/all'),
  // Admin
  adminCreate: (formData) => api.post('/cloth-brands/admin/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  adminUpdate: (id, data) => api.put(`/cloth-brands/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/cloth-brands/admin/${id}`),
  // Brand owner auth
  ownerLogin: (data) => api.post('/cloth-brands/auth/login', data),
  ownerProfile: (token) => api.get('/cloth-brands/owner/profile', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  ownerCreateDeal: (token, formData) => api.post('/cloth-brands/owner/deals', formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}`, timeout: 300000 },
  }),
  ownerUpdateDeal: (token, dealId, data) => api.put(`/cloth-brands/owner/deals/${dealId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  }),
  ownerDeleteDeal: (token, dealId) => api.delete(`/cloth-brands/owner/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

export default api;
