# 🐯 Shahkot Tigers — Complete Developer Documentation

**Author:** Salman | **Version:** 1.0.0 | **Last Updated:** February 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Authentication & Security](#9-authentication--security)
10. [Feature Guide](#10-feature-guide)
11. [Environment Configuration](#11-environment-configuration)
12. [Deployment Guide](#12-deployment-guide)
13. [Troubleshooting](#13-troubleshooting)
14. [Lessons Learned](#14-lessons-learned)

---

## 1. Introduction

### What is Shahkot Tigers?

Shahkot Tigers is a **community-first mobile application** built for the people of Shahkot, Pakistan. Think of it as a hyper-local super-app — it combines the functionality of **OLX** (buy & sell), **WhatsApp** (chat), **Geo News** (local news), a **matrimonial service**, **tournament organizer**, and more — all in one app, designed specifically for one city.

### Why did I build this?

Every small city in Pakistan deserves its own digital ecosystem. Shahkot Tigers bridges the gap between traditional word-of-mouth communication and modern technology. Instead of relying on Facebook groups or WhatsApp forwards, residents now have a dedicated platform.

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Mobile-First** | Built entirely with React Native + Expo for Android/iOS |
| **Geofenced** | Only users within 50km of Shahkot can register |
| **Admin-Controlled** | Sensitive features (Rishta, News) require admin approval |
| **Privacy-Focused** | CNIC verification for Rishta, report system for abuse |
| **Offline-Ready** | JWT tokens stored locally, graceful error handling |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        MOBILE APP                            │
│              React Native + Expo (expo-go)                   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │HomeScreen│ │FeedScreen│ │ChatScreen│ │MarketScreen  │    │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └──────┬───────┘    │
│        │            │            │              │            │
│        └────────────┴─────┬──────┴──────────────┘            │
│                           │                                  │
│               ┌───────────┴───────────┐                      │
│               │   API Service Layer   │                      │
│               │   (Axios + JWT)       │                      │
│               └───────────┬───────────┘                      │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTP/HTTPS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER                          │
│               Node.js + Express.js                           │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │Auth Route│ │Chat Route│ │Rishta Rt │ │Tournament Rt │    │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └──────┬───────┘    │
│        │            │            │              │            │
│        └────────────┴─────┬──────┴──────────────┘            │
│                           │                                  │
│               ┌───────────┴───────────┐                      │
│               │   Prisma ORM          │                      │
│               └───────────┬───────────┘                      │
│                           │                                  │
│               ┌───────────┴───────────┐                      │
│               │   PostgreSQL / SQLite │                      │
│               └───────────────────────┘                      │
│                                                              │
│  External Services:                                          │
│  • Cloudinary (Image hosting)                                │
│  • LongCat API (AI Chatbot)                                  │
│  • JWT (Authentication)                                      │
└──────────────────────────────────────────────────────────────┘
```

### Request Flow (Example: User logs in)

```
1. User types phone + password on LoginScreen
2. Frontend calls authAPI.login({ phone, password })
3. Axios interceptor adds headers, sends POST /api/auth/login
4. Backend normalizes phone number (03xx.. → +923xx..)
5. Prisma queries User table
6. bcrypt compares password hash
7. JWT token generated with user ID + role
8. Token returned to frontend
9. Frontend stores token in AsyncStorage
10. Axios interceptor auto-attaches token to all future requests
```

---

## 3. Technology Stack

### Backend

| Technology | Purpose | Why I chose it |
|-----------|---------|----------------|
| **Node.js** | Runtime | Non-blocking I/O, huge npm ecosystem |
| **Express.js** | Web framework | Minimal, fast, middleware-based |
| **Prisma** | ORM | Type-safe queries, auto migrations, Prisma Studio |
| **PostgreSQL** | Database | Reliable, supports JSON, scales well |
| **JWT** | Auth tokens | Stateless auth, no server-side sessions needed |
| **bcryptjs** | Password hashing | Industry standard, salted hashes |
| **Cloudinary** | Image storage | Free tier, auto-optimization, CDN delivery |
| **Multer** | File upload | Handles multipart/form-data in Express |
| **LongCat API** | AI Chatbot | OpenAI-compatible API for AI responses |

### Frontend

| Technology | Purpose | Why I chose it |
|-----------|---------|----------------|
| **React Native** | Cross-platform mobile | One codebase → Android + iOS |
| **Expo** | Development toolkit | No Xcode/Android Studio needed for dev |
| **Expo Go** | Testing app | Instant OTA updates, no build needed |
| **React Navigation** | Routing | Tab + Stack navigation, deep linking |
| **Axios** | HTTP client | Interceptors, automatic JSON, timeout handling |
| **AsyncStorage** | Local storage | Persistent key-value store for tokens |
| **expo-image-picker** | Camera/Gallery | Native image selection without native code |

---

## 4. Project Structure

```
e:\Shahkot\
├── backend\                          # Node.js API server
│   ├── .env                          # Environment variables (SECRET!)
│   ├── package.json                  # Dependencies
│   ├── prisma\
│   │   └── schema.prisma             # Database schema
│   └── src\
│       ├── server.js                 # Entry point — Express app setup
│       ├── config\
│       │   └── database.js           # Prisma client initialization
│       ├── middleware\
│       │   └── auth.js               # JWT verification, role checks
│       ├── routes\
│       │   ├── auth.js               # Register, Login, Profile
│       │   ├── chat.js               # Open Chat messages
│       │   ├── chatbot.js            # AI Chatbot (LongCat API)
│       │   ├── dm.js                 # Direct Messages
│       │   ├── listings.js           # Buy & Sell marketplace
│       │   ├── tournaments.js        # Sports tournaments
│       │   ├── rishta.js             # Matrimonial service
│       │   ├── news.js               # News articles
│       │   ├── liveEvents.js         # Live streaming events
│       │   ├── blood.js              # Blood donation
│       │   ├── shops.js              # Local shops directory
│       │   ├── govtOffices.js        # Government offices
│       │   ├── admin.js              # Admin dashboard APIs
│       │   ├── notifications.js      # Push notifications
│       │   └── reports.js            # User reports
│       └── utils\
│           ├── upload.js             # Multer configurations
│           └── cloudinaryUpload.js   # Cloudinary helpers
│
└── ShahkotApp\                       # React Native (Expo) mobile app
    ├── app.json                      # Expo configuration
    ├── App.js                        # Root navigator (Stack + Tabs)
    ├── package.json                  # Dependencies
    └── src\
        ├── config\
        │   └── constants.js          # API_URL, APP_NAME, colors, geofence
        ├── context\
        │   └── AuthContext.js         # React Context for auth state
        ├── services\
        │   └── api.js                # ALL API calls (Axios instance)
        ├── components\
        │   └── PostCard.js           # Reusable post card component
        └── screens\
            ├── SplashScreen.js       # App loading screen
            ├── LoginScreen.js        # Phone + password login
            ├── RegisterScreen.js     # New user registration
            ├── HomeScreen.js         # Dashboard with quick access
            ├── ExploreScreen.js      # Feature discovery grid
            ├── FeedScreen.js         # Social media feed
            ├── VideoFeedScreen.js    # TikTok-style video feed
            ├── OpenChatScreen.js     # Community group chat
            ├── MarketplaceScreen.js  # Buy & Sell (OLX-style)
            ├── TournamentsScreen.js  # Sports tournaments
            ├── TournamentDetailScreen.js  # Single tournament view
            ├── LiveEventsScreen.js   # YouTube/Facebook live streams
            ├── RishtaScreen.js       # Matrimonial service
            ├── DMChatScreen.js       # Direct messages
            ├── NewsScreen.js         # Local news articles
            ├── BloodDonationScreen.js # Blood donor registry
            ├── BazarScreen.js        # Local shops directory
            ├── GovtOfficesScreen.js   # Government offices
            ├── HelplineScreen.js     # Emergency helplines
            ├── AIChatbotScreen.js    # AI assistant
            ├── ProfileScreen.js      # User profile editor
            ├── AdminDashboardScreen.js # Admin control panel
            └── NotificationsScreen.js  # User notifications
```

---

## 5. Backend Deep Dive

### 5.1 Server Setup (`server.js`)

The server is the heart of the backend. Here's how it's structured:

```javascript
// server.js - Simplified view
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());                    // Allow cross-origin requests
app.use(express.json());            // Parse JSON bodies
app.use(express.urlencoded({...})); // Parse form data

// Routes — each feature has its own file
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/rishta', rishtaRoutes);
// ... and so on

app.listen(5000, () => console.log('Server running on port 5000'));
```

**Key Concept:** Separation of concerns. Each feature lives in its own route file. This means if something breaks in the Rishta feature, I can debug `routes/rishta.js` without touching anything else.

### 5.2 Authentication Middleware (`middleware/auth.js`)

```javascript
// The 'authenticate' middleware runs BEFORE any protected route
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next(); // Continue to the actual route handler
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Why middleware?** Instead of writing token verification in EVERY route, I write it ONCE and apply it everywhere. This is the DRY (Don't Repeat Yourself) principle.

### 5.3 Phone Number Normalization

A user might type `03123456789` or `+923123456789` — both are the same number. Without normalization, the database would treat them as two different users!

```javascript
const normalizePhone = (phone) => {
  let cleaned = phone.replace(/[^0-9+]/g, ''); // Remove non-numeric
  if (cleaned.startsWith('03')) {
    cleaned = '+92' + cleaned.slice(1);  // 03xxx → +923xxx
  } else if (cleaned.startsWith('923')) {
    cleaned = '+' + cleaned;             // 923xxx → +923xxx
  }
  return cleaned;
};
```

### 5.4 File Upload System (`utils/upload.js`)

Multer is a middleware that handles `multipart/form-data` — the format browsers use to send files.

```javascript
// Different upload configs for different features
const upload = multer({
  storage: multer.memoryStorage(),  // Store in RAM temporarily
  limits: { fileSize: 5 * 1024 * 1024 },  // Max 5MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed!'), false);
  },
});

// Rishta needs multiple file fields
const uploadRishta = multer({...}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);
```

---

## 6. Frontend Deep Dive

### 6.1 API Service Layer (`services/api.js`)

This is the **single source of truth** for all API calls. Every screen imports from this one file.

```javascript
// Create a configured Axios instance
const api = axios.create({
  baseURL: API_URL,     // e.g., http://192.168.0.112:5000/api
  timeout: 15000,       // 15 seconds max wait
});

// AUTOMATIC token injection — no need to add it manually
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Export feature-specific API objects
export const chatAPI = {
  getMessages: (page) => api.get(`/chat/messages?page=${page}`),
  sendMessage: (data) => api.post('/chat/messages', data),
};
```

**Why interceptors?** Without them, you'd write `headers: { Authorization: 'Bearer ' + token }` in EVERY API call. Interceptors do it automatically.

### 6.2 Authentication Context (`context/AuthContext.js`)

React Context lets any screen access the logged-in user without passing props down through 10 levels.

```javascript
// Any screen can do this:
const { user, isAdmin, logout } = useAuth();

// Instead of:
// props.navigation.getParam('user').checkIfAdmin()...
```

### 6.3 Navigation Architecture (`App.js`)

```
Stack Navigator (Root)
├── Splash Screen
├── Login Screen
├── Register Screen
└── Tab Navigator (Main App)
    ├── Home Tab → HomeScreen
    ├── Feed Tab → FeedScreen
    ├── Chat Tab → OpenChatScreen
    ├── Market Tab → MarketplaceScreen
    └── Profile Tab → ProfileScreen
    
    Additional Stack Screens:
    ├── Tournaments, TournamentDetail
    ├── LiveEvents
    ├── Rishta, DMChat
    ├── News & Articles
    ├── Blood Donation
    ├── Bazar (Shops)
    ├── Government Offices
    ├── Helplines
    ├── AI Chatbot
    ├── Admin Dashboard
    ├── Notifications
    └── Explore
```

### 6.4 State Management Pattern

I use **local state** (useState) for most things, not Redux or MobX. Here's why:

| Approach | When to use | Used in Shahkot Tigers |
|----------|-------------|----------------------|
| `useState` | Single-screen data | ✅ All screens |
| `useContext` | App-wide shared data | ✅ Auth (user, token) |
| `useCallback` | Prevent re-renders | ✅ Chat polling |
| Redux | Complex state with many writers | ❌ Overkill for this app |

---

## 7. Database Schema

### 7.1 Entity Relationship Overview

```
User (1) ─────── (N) Listing        → A user can post many listings
User (1) ─────── (N) Post           → A user can create many posts
User (1) ─────── (1) RishtaProfile  → A user has one rishta profile
User (1) ─────── (N) ChatMessage    → A user sends many chat messages
User (1) ─────── (N) DMChat         → A user participates in many DMs
User (1) ─────── (N) Tournament     → A user (admin) creates tournaments
User (1) ─────── (N) News           → A reporter creates many articles
User (1) ─────── (1) BloodDonor     → A user registers as blood donor
```

### 7.2 Key Models

**User Model:**
```prisma
model User {
  id        String   @id @default(cuid())
  phone     String   @unique
  password  String
  name      String
  email     String?
  photoUrl  String?
  role      Role     @default(USER)    // USER, ADMIN, REPORTER
  isActive  Boolean  @default(true)
  lat       Float?
  lng       Float?
  createdAt DateTime @default(now())
}
```

**Listing Model (Buy & Sell):**
```prisma
model Listing {
  id          String   @id @default(cuid())
  title       String
  description String?
  price       Float
  category    Category  // ELECTRONICS, VEHICLES, PROPERTY, etc.
  images      String[]  // Array of Cloudinary URLs
  whatsapp    String?
  location    String?
  isSold      Boolean  @default(false)
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
}
```

**RishtaProfile Model:**
```prisma
model RishtaProfile {
  id              String   @id @default(cuid())
  age             Int
  gender          String
  education       String
  occupation      String
  familyDetails   String?
  preferences     String?
  cnicFront       String   // Cloudinary URL
  cnicBack        String   // Cloudinary URL
  images          String[] // Profile photos
  status          RishtaStatus @default(PENDING) // PENDING → APPROVED/REJECTED
  signatureAgreed Boolean  @default(false)
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
}
```

---

## 8. API Reference

### 8.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create new user (geofence checked) |
| POST | `/api/auth/login` | ❌ | Login with phone + password |
| GET | `/api/auth/profile` | ✅ | Get logged-in user's profile |
| PUT | `/api/auth/profile` | ✅ | Update profile details |
| POST | `/api/auth/profile/photo` | ✅ | Upload profile photo |
| POST | `/api/auth/check-location` | ❌ | Verify if user is in Shahkot area |

### 8.2 Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/chat/messages?page=1` | ✅ | Get community chat messages |
| POST | `/api/chat/messages` | ✅ | Send a new message |
| POST | `/api/chat/report` | ✅ | Report a message |

### 8.3 Marketplace (Buy & Sell)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/listings` | ✅ | Get all listings (search, category filter) |
| GET | `/api/listings/:id` | ✅ | Get single listing details |
| POST | `/api/listings` | ✅ | Create new listing (multipart) |
| PUT | `/api/listings/:id` | ✅ | Update listing |
| DELETE | `/api/listings/:id` | ✅ | Delete listing (owner/admin only) |

### 8.4 Tournaments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tournaments` | ✅ | List tournaments (filter by sport) |
| GET | `/api/tournaments/:id` | ✅ | Tournament details + matches |
| POST | `/api/tournaments` | ✅ | Create tournament (multipart) |
| POST | `/api/tournaments/:id/matches` | ✅ | Add a match |
| DELETE | `/api/tournaments/:id` | ✅ | Delete (creator/admin) |

### 8.5 Rishta (Matrimonial)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rishta/agreement` | ✅ | Get terms & conditions |
| GET | `/api/rishta/my-profile` | ✅ | Check if user has a profile |
| POST | `/api/rishta/apply` | ✅ | Submit application (CNIC + photos) |
| GET | `/api/rishta/profiles` | ✅ | Browse approved profiles |
| DELETE | `/api/rishta/withdraw` | ✅ | Delete own profile |

### 8.6 Direct Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/dm/start/:userId` | ✅ | Start or get existing chat |
| GET | `/api/dm/chats` | ✅ | List all conversations |
| GET | `/api/dm/:chatId/messages` | ✅ | Get messages in a chat |
| POST | `/api/dm/:chatId/messages` | ✅ | Send a message |
| POST | `/api/dm/:chatId/report` | ✅ | Report a user |

### 8.7 Other APIs

| Feature | Endpoints |
|---------|-----------|
| **News** | GET/POST/DELETE `/api/news` |
| **Live Events** | GET/POST/PUT/DELETE `/api/live-events` |
| **Blood Donation** | GET/POST/PUT/DELETE `/api/blood` |
| **Shops** | GET/POST/PUT/DELETE `/api/shops` |
| **Govt Offices** | GET/POST/PUT/DELETE `/api/govt-offices` |
| **AI Chatbot** | POST `/api/chatbot/message` |
| **Admin** | GET/PUT `/api/admin/*` |
| **Reports** | GET/POST/PUT `/api/reports` |
| **Notifications** | GET/PUT `/api/notifications` |

---

## 9. Authentication & Security

### 9.1 Registration Flow

```
User enters: Name, Phone, Password, Location
       │
       ▼
┌──────────────────────┐
│ Geofence Check        │ ← Is user within 50km of Shahkot?
│ (lat/lng calculation) │
└──────────┬───────────┘
           │ Yes
           ▼
┌──────────────────────┐
│ Phone Normalization   │ ← 03xx → +923xx for consistency
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Check if phone exists │ ← Prevent duplicate accounts
└──────────┬───────────┘
           │ No duplicate
           ▼
┌──────────────────────┐
│ Hash password with    │ ← bcrypt with 10 salt rounds
│ bcrypt                │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Create user in DB     │
│ Generate JWT token    │ ← Token expires in 30 days
│ Return user + token   │
└──────────────────────┘
```

### 9.2 Security Measures

| Measure | How |
|---------|-----|
| Password hashing | bcrypt (10 rounds) — even I can't read passwords |
| Token expiry | JWT expires in 30 days |
| Auto-logout | 401 response → clear AsyncStorage → redirect to login |
| Rate limiting | Express rate limiter on auth routes |
| CNIC verification | Required for Rishta — prevents catfishing |
| Report system | Users can report abusive content/users |
| Admin control | Admins can disable/block users from dashboard |
| Geofencing | Only Shahkot-area residents can register |

---

## 10. Feature Guide

### 10.1 🏠 Home Screen
- Greeting with user's name
- Quick access grid (8 features)
- Trending listings (horizontal scroll)
- Latest news cards
- Upcoming tournament cards
- **Floating AI button** (bottom-right, purple sparkle ✨)

### 10.2 📱 Social Feed
- Create posts with text, images, videos
- Like, comment, share functionality
- Delete own posts or admin can delete any
- Watch Videos button → TikTok-style full-screen feed
- Share to WhatsApp integration

### 10.3 💬 Open Chat
- Community-wide group chat
- 8-second polling for new messages
- Image attachments (up to 3)
- Reply to messages
- Report inappropriate messages
- `keyboardShouldPersistTaps="handled"` for smooth UX

### 10.4 🛒 Buy & Sell (Marketplace)
- OLX Pakistan-style UI
- Categories: Electronics, Vehicles, Property, Clothing, etc.
- 2-column card grid layout
- Image carousel in detail view
- WhatsApp contact button
- Negotiate button
- Seller info with "Member Since"
- PKR price formatting (Lakh/Crore)
- Owner/Admin can delete listings

### 10.5 🏆 Tournaments
- Create tournaments with sport type, dates, venue
- Sports: Cricket, Football, Kabaddi, Volleyball, Hockey, etc.
- Status badges: Upcoming (blue), Live (green), Completed (gray)
- Filter by sport type
- Share tournament details
- Creator OR admin can delete

### 10.6 💕 Dill ka Rishta
- Digital agreement with checkbox (must agree before applying)
- Application form: age, gender, education, occupation, family
- CNIC front + back upload (verification)
- Profile photos (up to 3)
- Admin reviews and approves/rejects
- Approved users can browse profiles
- DM messaging between approved users
- Withdraw/delete profile option
- Report user for abuse

### 10.7 🤖 AI Chatbot
- WhatsApp-style chat UI
- Quick suggestion chips in Roman Urdu
- Typing indicator animation
- System prompt restricts AI to app-related questions only
- Powered by LongCat API (OpenAI-compatible)

### 10.8 🎥 Live Events
- YouTube/Facebook URL parsing
- Auto-generated YouTube thumbnails
- Source badges (🔴 YouTube / 🔵 Facebook)
- Admin creates/manages events
- Toggle Live/Ended status
- Opens in YouTube/Facebook app via `Linking.openURL()`

### 10.9 📰 News & Articles
- Admin/Reporter publishes articles
- Category-based filtering
- Share articles to WhatsApp
- Image attachments

### 10.10 🩸 Blood Donation
- Register as blood donor (blood group, address, availability)
- Search donors by blood group
- Contact donors

### 10.11 🏪 Bazar (Shops Directory)
- Search local shops
- Category-based browsing
- Shop details with contact info

### 10.12 🏛 Government Offices
- Directory of local government offices
- Contact information
- Location details

### 10.13 📞 Helplines
- Emergency phone numbers
- Police, Hospital, Fire, etc.

### 10.14 👨‍💼 Admin Dashboard
- **Compact 3-per-row** stat cards (Users, Posts, Listings, etc.)
- Recent Users section with active/inactive indicators
- Pending Rishta approvals with CNIC images
- Content management (delete listings, news)
- User management (search, enable/disable)
- Reports management (block user / dismiss)

---

## 11. Environment Configuration

### Backend `.env` file

```env
DATABASE_URL="postgresql://user:pass@host:port/db"
JWT_SECRET="your-secret-key-here"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
LONGCAT_API_KEY="your-longcat-api-key"
LONGCAT_API_URL="https://api.longcat.fun/v1/chat/completions"
LONGCAT_MODEL="claude-sonnet-4-20250514"
PORT=5000
```

### Frontend `constants.js`

```javascript
const DEV_API_URL = 'http://192.168.0.112:5000/api'; // Your local IP
const PROD_API_URL = 'https://your-api.com/api';

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const APP_NAME = 'Shahkot Tigers';
export const GEOFENCE_CENTER = { lat: 31.5716, lng: 73.4833 }; // Shahkot
export const GEOFENCE_RADIUS_KM = 50;
```

⚠️ **Important:** When testing on a physical phone with Expo Go, use your computer's **local network IP** (e.g., `192.168.0.112`), NOT `localhost`.

---

## 12. Deployment Guide

### 12.1 Running Locally

**Backend:**
```bash
cd e:\Shahkot\backend
npm install
npx prisma db push         # Create/update database tables
npm run dev                 # Start server on port 5000
```

**Frontend:**
```bash
cd e:\Shahkot\ShahkotApp
npm install
npx expo start             # Start Metro bundler
# Scan QR code with Expo Go app on your phone
```

**Database Studio (Visual DB Editor):**
```bash
cd e:\Shahkot\backend
npx prisma studio           # Opens web UI at localhost:5555
```

### 12.2 Production Deployment

**Backend → Railway/Render/Heroku:**
1. Push code to GitHub
2. Connect GitHub repo to Railway/Render
3. Set environment variables in dashboard
4. Deploy automatically on push

**Frontend → EAS Build (Expo):**
```bash
npm install -g eas-cli
eas login
eas build --platform android    # Creates APK/AAB
eas submit --platform android   # Uploads to Play Store
```

### 12.3 Database Migration

When you change `schema.prisma`:
```bash
npx prisma db push                    # Development (fast, might lose data)
npx prisma migrate dev --name "desc"  # Production (creates migration files)
```

---

## 13. Troubleshooting

### Common Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| `AxiosError: Request failed with status code 401` | Token expired or invalid | Re-login. Check JWT_SECRET matches between restarts |
| `AxiosError: Network Error` | Backend not running or wrong IP | Ensure `npm run dev` is running. Check IP in `constants.js` |
| `getListings is not a function` | API name mismatch | We fixed this — api.js now has aliases for all names |
| `Property 'formImage' doesn't exist` | State variable missing | We restored formImage in TournamentsScreen |
| `ImagePicker.MediaTypeOptions deprecated` | Old API usage | Changed to `mediaTypes: ['images']` format |
| `429 Too Many Requests` | Rate limiting / too fast polling | Reduced chat polling to 8 seconds |
| `500 Internal Server Error` from admin | Missing data in DB | Ensure `prisma db push` has been run |
| `newArchEnabled` warning | Explicit false in app.json | Removed the flag — Expo Go uses new arch automatically |
| `EADDRINUSE port 5000` | Port already in use | Kill the other process or change PORT in .env |

### How to Debug

1. **Backend errors:** Check the terminal running `npm run dev`
2. **Frontend errors:** Check the Expo terminal output
3. **Database issues:** Open `npx prisma studio` and inspect data
4. **Network issues:** Use `adb logcat` or React Native Debugger

---

## 14. Lessons Learned

### Architecture Decisions

1. **Why no Redux?** For an app this size, `useState` + `useContext` is simpler. Redux adds boilerplate. I'd add it only if state management becomes painful.

2. **Why Prisma over raw SQL?** Type safety, auto-generated client, and Prisma Studio. The trade-off is slightly less flexibility for complex queries.

3. **Why Expo Go instead of dev build?** Speed. Friends can download Expo Go and test immediately. No need to share APK files during development.

4. **Why Cloudinary?** Free tier gives 25GB storage + auto-optimization. Images are served via CDN, so they load fast even on slow Pakistan 4G.

5. **Why LongCat API?** OpenAI-compatible API that works with Claude models. The system prompt ensures the AI only answers app-related questions, preventing misuse.

### What I'd Do Differently

1. **Add WebSocket for chat** instead of polling — reduces server load
2. **Add push notifications** via Expo Push — instead of polling for new messages
3. **Add image compression** on frontend before upload — save bandwidth
4. **Add pagination everywhere** — currently some lists load all data
5. **Add caching** with React Query — reduce API calls for unchanged data

### Performance Tips

- Chat polling: 8 seconds (not 2 — reduces 4x server load)
- Image quality: 0.7 (not 1.0 — 30% smaller files)
- `keyboardShouldPersistTaps="handled"` — prevents keyboard dismissal bugs
- `Promise.allSettled` — loads multiple APIs in parallel, doesn't fail if one fails
- `useCallback` for functions passed to FlatList — prevents unnecessary re-renders

---

## Appendix: All Files Modified in This Session

| File | Changes |
|------|---------|
| `api.js` | Added aliases: `listingAPI`, `tournamentAPI`, convenience methods |
| `TournamentsScreen.js` | Added `formImage` state, fixed date pickers, fixed ImagePicker |
| `LiveEventsScreen.js` | Removed DateTimePicker, text date input, fixed ImagePicker |
| `AdminDashboardScreen.js` | Compact 3-per-row stats, recent users, blood donors stat |
| `HomeScreen.js` | Added floating AI FAB button |
| `FeedScreen.js` | Fixed ImagePicker, renamed to Shahkot Tigers |
| `MarketplaceScreen.js` | Fixed ImagePicker, renamed |
| `RishtaScreen.js` | Fixed ImagePicker |
| `OpenChatScreen.js` | Fixed ImagePicker |
| `NewsScreen.js` | Fixed ImagePicker, renamed |
| `ProfileScreen.js` | Fixed ImagePicker |
| `AIChatbotScreen.js` | Renamed welcome message |
| `SplashScreen.js` | Renamed title |
| `VideoFeedScreen.js` | Renamed share text and album |
| `PostCard.js` | Renamed share text |
| `constants.js` | `APP_NAME = 'Shahkot Tigers'` |
| `app.json` | Name: Shahkot Tigers, removed `newArchEnabled: false` |
| `rishta.js` (backend) | Renamed agreement text |

---

> **"The best way to learn coding is to build something real."**
> — This project is proof of that. Every bug you fixed, every feature you designed, every error you debugged — that's real development experience.

🐯 **Shahkot Tigers** — Made with ❤️ for the people of Shahkot.
