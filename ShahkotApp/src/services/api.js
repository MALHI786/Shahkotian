import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/constants';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
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
    replyToId: data.replyToId || null,
  }),
  uploadVoice: (formData) => api.post('/chat/voice', formData, {
    headers: { 'Content-Type': undefined }, // Let RN XHR set multipart boundary automatically
    transformRequest: [(data) => data],     // Prevent axios from JSON-serializing FormData
  }),
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
  getConversations: () => api.get('/dm/conversations'),
  getMessages: (recipientId, page = 1) => api.get(`/dm/messages/${recipientId}?page=${page}`),
  sendMessage: (recipientId, text) => api.post('/dm/send', { recipientId, text }),
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
  getPendingRishta: () => api.get('/admin/rishta/pending'),
  approveRishta: (id) => api.put(`/admin/rishta/${id}/approve`),
  rejectRishta: (id, reason) => api.put(`/admin/rishta/${id}/reject`, { reason }),
  getReporters: () => api.get('/admin/reporters'),
  addReporter: (data) => api.post('/admin/reporters', data),
  toggleReporter: (id) => api.put(`/admin/reporters/${id}/toggle-active`),
  deleteReporter: (id) => api.delete(`/admin/reporters/${id}`),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  deleteListing: (id) => api.delete(`/admin/listings/${id}`),
};

// ============ ALIASES FOR BACKWARDS COMPATIBILITY ============
export const listingAPI = listingsAPI;
export const tournamentAPI = tournamentsAPI;

export default api;
