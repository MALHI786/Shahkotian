require('dotenv').config();
// Initialize Firebase Admin if configured
require('./config/firebase');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const prisma = require('./config/database');
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
const bloodRoutes = require('./routes/blood');
const chatRoutes = require('./routes/chat');
const chatbotRoutes = require('./routes/chatbot');
const dmRoutes = require('./routes/dm');
const jobRoutes = require('./routes/jobs');
const reportRoutes = require('./routes/reports');
const doctorRoutes = require('./routes/doctors');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression()); // Compress all responses for faster transfer
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs (increased for chat polling)
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Apna Shahkot API is running', timestamp: new Date() });
});

// Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const dbManager = prisma.__dbManager;
    if (dbManager) {
      const statuses = await dbManager.getAllStatus();
      return res.json({ activeDatabase: dbManager.activeIndex, totalDatabases: dbManager.databases.length, databases: statuses });
    }
    res.json({ activeDatabase: 0, totalDatabases: 1, databases: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get DB status.' });
  }
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
app.use('/api/blood', bloodRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/reports', reportRoutes);

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

async function startServer() {
  try {
    // initialize database manager if available
    if (prisma && prisma.__dbManager) {
      await prisma.__dbManager.initialize();
      console.log('✅ Database manager initialized');
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Apna Shahkot API running on port ${PORT}`);
      console.log(`📍 Geofence: ${process.env.SHAHKOT_LAT}, ${process.env.SHAHKOT_LNG} (${process.env.GEOFENCE_RADIUS_KM}km radius)`);

      // Keep-alive self-ping — prevents Render free tier from sleeping after 15 min idle
      const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      const pingUrl = `${selfUrl}/api/health`;
      const pingClient = require(pingUrl.startsWith('https') ? 'https' : 'http');
      setInterval(() => {
        pingClient.get(pingUrl, (res) => {
          console.log(`♻️ Keep-alive ping OK (${res.statusCode})`);
        }).on('error', (e) => {
          console.log(`⚠️ Keep-alive ping failed: ${e.message}`);
        });
      }, 14 * 60 * 1000); // Every 14 minutes
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        try {
          if (prisma && prisma.__dbManager) {
            await prisma.__dbManager.disconnectAll();
            console.log('✅ All database connections closed');
          } else {
            await prisma.$disconnect();
          }
        } catch (e) {
          console.error('Error during shutdown:', e.message);
        }
        console.log('👋 Server shut down successfully');
        process.exit(0);
      });

      // Force exit after 10s if graceful shutdown fails
      setTimeout(() => {
        console.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
