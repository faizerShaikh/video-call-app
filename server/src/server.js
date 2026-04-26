import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { setupSocket, getActiveRooms } from './socket.js';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import turnRoutes from './routes/turn.js';

dotenv.config();

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

const app = express();
const httpServer = createServer(app);

console.log('🌐 CORS Configuration: allow all origins');

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
  // For Vercel/serverless: Only use polling (websockets don't work with serverless)
  // For regular servers: Can use ['polling', 'websocket']
  transports: isVercel ? ['polling'] : ['polling', 'websocket'],
  allowUpgrades: !isVercel, // Disable transport upgrades on Vercel
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
});

// More permissive CORS for development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// Compression middleware
app.use(compression());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDatabase().catch(console.error);

// Routes
app.get("/", (req, res) => {
  res.json({ 
    message: "WebRTC Signaling Server",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      users: "/api/users",
      admin: "/api/admin",
      turnCredentials: "/api/turn-credentials"
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', turnRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const mongoose = (await import('mongoose')).default;
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok', 
    message: 'WebRTC signaling server is running',
    timestamp: new Date().toISOString(),
    socketio: 'ready',
    database: dbStatus,
    cors: {
      mode: process.env.NODE_ENV || 'development',
      allowedOrigins: process.env.CORS_ORIGIN || 'all (development)',
    },
    vercel: isVercel,
    socketTransports: isVercel ? ['polling'] : ['polling', 'websocket'],
  });
});

// Get active rooms endpoint
app.get('/api/rooms', (req, res) => {
  const activeRooms = getActiveRooms();
  res.json({ 
    rooms: activeRooms,
    count: activeRooms.length,
    timestamp: new Date().toISOString(),
  });
});

// Handle Socket.io polling endpoint CORS explicitly
app.use('/socket.io/', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  next();
});

// Handle OPTIONS requests for CORS preflight (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  } else {
    next();
  }
});

// Setup Socket.io handlers
setupSocket(io);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📡 Socket.io server ready for connections`);
  if (isVercel) {
    console.log(`⚠️  Running on Vercel - Using polling transport only (WebSockets not supported)`);
  } else {
    console.log(`🌐 Accessible from: http://localhost:${PORT} and your local network IP`);
  }
});

