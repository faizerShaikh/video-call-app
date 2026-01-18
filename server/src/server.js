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

dotenv.config();

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow localhost, local network IPs, and common hosting platforms
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://localhost:5173',
      'https://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+:5173$/,  // 192.168.x.x
      /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,   // 10.x.x.x
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:5173$/, // 172.16-31.x.x
      /^https?:\/\/.*\.vercel\.app$/,        // Vercel deployments
      /^https?:\/\/.*\.netlify\.app$/,       // Netlify deployments
      /^https?:\/\/.*\.github\.io$/,         // GitHub Pages
      /^https?:\/\/.*\.railway\.app$/,       // Railway deployments
      /^https?:\/\/.*\.railway\.xyz$/,       // Railway deployments (alternative domain)
      /^https?:\/\/.*\.render\.com$/,        // Render deployments
      /^https?:\/\/.*\.onrender\.com$/,      // Render deployments (alternative domain)
    ];

console.log('🌐 CORS Configuration:', {
  mode: process.env.NODE_ENV || 'development',
  customOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 'none',
  defaultPatterns: 'localhost, local IPs, vercel, netlify, github, railway, render',
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log('🌐 Development mode: allowing origin:', origin || 'no origin');
        return callback(null, true);
      }
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('⚠️  Request with no origin, allowing');
        return callback(null, true);
      }
      
      console.log('🌐 Checking origin:', origin);
      
      // Check if origin matches allowed origins
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        console.log('✅ Origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('❌ Origin not allowed:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
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
  origin: (origin, callback) => {
    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return callback(null, true);
    }
    
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
      admin: "/api/admin"
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

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

