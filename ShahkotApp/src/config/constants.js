// Shahkot App API Configuration
const DEV_API_URL = 'http://192.168.0.112:5000/api'; // Local network
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://shahkotian.onrender.com/api';

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// Shahkot Center Coordinates
export const SHAHKOT_CENTER = {
  latitude: 31.9712,
  longitude: 73.4818,
};

export const GEOFENCE_RADIUS_KM = 50;

// App Constants
export const APP_NAME = 'Shahkot Tigers';
export const APP_VERSION = '1.0.0';

// Listing Categories
export const LISTING_CATEGORIES = [
  { key: 'ELECTRONICS', label: 'Electronics', icon: '📱' },
  { key: 'VEHICLES', label: 'Vehicles', icon: '🚗' },
  { key: 'PROPERTY', label: 'Property', icon: '🏠' },
  { key: 'FURNITURE', label: 'Furniture', icon: '🪑' },
  { key: 'CLOTHING', label: 'Clothing', icon: '👕' },
  { key: 'SPORTS', label: 'Sports', icon: '⚽' },
  { key: 'BOOKS', label: 'Books', icon: '📚' },
  { key: 'HOME_APPLIANCES', label: 'Appliances', icon: '🏠' },
  { key: 'MOBILE_PHONES', label: 'Mobiles', icon: '📱' },
  { key: 'OTHER', label: 'Other', icon: '📦' },
];

// Sport Types
export const SPORT_TYPES = [
  { key: 'CRICKET', label: 'Cricket', icon: '🏏' },
  { key: 'FOOTBALL', label: 'Football', icon: '⚽' },
  { key: 'KABADDI', label: 'Kabaddi', icon: '🤼' },
  { key: 'VOLLEYBALL', label: 'Volleyball', icon: '🏐' },
  { key: 'HOCKEY', label: 'Hockey', icon: '🏑' },
  { key: 'BADMINTON', label: 'Badminton', icon: '🏸' },
  { key: 'TABLE_TENNIS', label: 'Table Tennis', icon: '🏓' },
  { key: 'OTHER', label: 'Other', icon: '🏆' },
];

// News Categories
export const NEWS_CATEGORIES = [
  { key: 'LOCAL', label: 'Local' },
  { key: 'SPORTS', label: 'Sports' },
  { key: 'EDUCATION', label: 'Education' },
  { key: 'POLITICS', label: 'Politics' },
  { key: 'BUSINESS', label: 'Business' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'ENTERTAINMENT', label: 'Entertainment' },
  { key: 'OTHER', label: 'Other' },
];

// Theme Colors - Pakistan Green Identity
export const COLORS = {
  primary: '#0C8A43',
  primaryDark: '#06692F',
  primaryLight: '#4CAF50',
  secondary: '#FF6584',
  accent: '#FFC107',
  accentDark: '#FF8F00',
  background: '#F0F4F0',
  surface: '#FFFFFF',
  text: '#1A2E1A',
  textSecondary: '#5A6B5A',
  textLight: '#8A9B8A',
  border: '#D4E0D4',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  whatsapp: '#25D366',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#EDF2ED',
  darkGray: '#374137',
  headerBg: '#0C8A43',
  cardShadow: '#0C8A43',
};

export const FONTS = {
  regular: 'System',
  bold: 'System',
};

// Video Limits
export const MAX_VIDEO_DURATION_SECONDS = 180; // 3 minutes
export const MAX_VIDEO_SIZE_MB = 100;

// Privacy Options
export const PRIVACY_OPTIONS = [
  { key: 'PUBLIC', label: 'Public', icon: '🌍', description: 'Anyone can see this post' },
  { key: 'FRIENDS', label: 'Friends', icon: '👥', description: 'Only your friends' },
  { key: 'PRIVATE', label: 'Only Me', icon: '🔒', description: 'Only you can see this post' },
];
