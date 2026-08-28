const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

mongoose.set('bufferCommands', false);

const app = express();

// Middleware
app.use(cors({
  origin: '*', // For development. Can be restricted to client Vercel URL in production.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes imports
const authRoutes = require('./routes/auth');
const matchweekRoutes = require('./routes/matchweek');
const predictionRoutes = require('./routes/predictions');
const battleRoutes = require('./routes/battle');
const adminRoutes = require('./routes/admin');
const groupRoutes = require('./routes/group');
const { startAutoResultSync } = require('./utils/autoResultFetcher');

// Database Connection with caching for Vercel Serverless Functions
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';
let cachedDbPromise = null;

async function connectDB() {
  const dns = require('dns');
  try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedDbPromise) {
    cachedDbPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    }).then(m => {
      console.log('Connected to MongoDB Database.');
      mongoose.connection.collection('matchweeks').dropIndex('matchweekNumber_1').catch(() => {});
      return m;
    }).catch(err => {
      cachedDbPromise = null;
      console.error('Database connection error:', err.message);
      throw err;
    });
  }

  return await cachedDbPromise;
}

// Middleware to ensure DB connection is 100% complete on every request (MUST BE BEFORE ROUTES)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({
      message: `Database connection error: ${err.message}. Please verify MONGODB_URI environment variable on Vercel.`
    });
  }
});

// Routes middlewares
app.use('/api/auth', authRoutes);
app.use('/api/matchweek', matchweekRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/group', groupRoutes);

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected server error occurred.'
  });
});

// Start background match result & scoring auto-poller worker if running long-lived server
if (!process.env.VERCEL) {
  connectDB().then(() => {
    const intervalMinutes = process.env.AUTO_SYNC_INTERVAL_MINUTES ? Number(process.env.AUTO_SYNC_INTERVAL_MINUTES) : 5;
    startAutoResultSync(intervalMinutes);
  }).catch(e => console.error('Failed initial DB connect:', e.message));

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
