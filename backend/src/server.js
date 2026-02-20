require('dotenv').config();
// Initialize Firebase Admin if configured
require('./config/firebase');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const listingRoutes = require('./routes/listings');
const tournamentRoutes = require('./routes/tournaments');
const govtOfficeRoutes = require('./routes/govtOffices');
const shopRoutes = require('./routes/shops');
const rishtaRoutes = require('./routes/rishta');
const newsRoutes = require('./routes/news');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const policeRoutes = require('./routes/police');
const bloodRoutes = require('./routes/blood');
const chatRoutes = require('./routes/chat');
const chatbotRoutes = require('./routes/chatbot');
const dmRoutes = require('./routes/dm');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Shahkot App API is running', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/govt-offices', govtOfficeRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/rishta', rishtaRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/police', policeRoutes);
app.use('/api/blood', bloodRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/dm', dmRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Shahkot App API running on port ${PORT}`);
  console.log(`📍 Geofence: ${process.env.SHAHKOT_LAT}, ${process.env.SHAHKOT_LNG} (${process.env.GEOFENCE_RADIUS_KM}km radius)`);
});

module.exports = app;
