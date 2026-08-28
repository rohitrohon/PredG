require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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

// Routes middlewares
app.use('/api/auth', authRoutes);
app.use('/api/matchweek', matchweekRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/group', groupRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Prediction Game 3.0 server is running.' });
});

const { startAutoResultSync } = require('./utils/autoResultFetcher');

// Database Connection with caching for Vercel Serverless Functions
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prediction_game';
let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB Database.');
    try {
      await mongoose.connection.collection('matchweeks').dropIndex('matchweekNumber_1');
    } catch (e) {
      // Ignore if index was already dropped
    }
  } catch (err) {
    console.error('Database connection error:', err);
  }
}

// Middleware to ensure DB connection on every request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Start background match result & scoring auto-poller worker if running long-lived server
if (!process.env.VERCEL) {
  connectDB().then(() => {
    const intervalMinutes = process.env.AUTO_SYNC_INTERVAL_MINUTES ? Number(process.env.AUTO_SYNC_INTERVAL_MINUTES) : 5;
    startAutoResultSync(intervalMinutes);
  });

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
