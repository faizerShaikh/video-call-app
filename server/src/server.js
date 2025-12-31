import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocket } from './socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow localhost and local network IPs
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',')
  : [
      'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+:5173$/,  // 192.168.x.x
      /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,   // 10.x.x.x
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:5173$/, // 172.16-31.x.x
    ];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
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
        // In development, be more permissive
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Development mode: allowing origin anyway');
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
  transports: ['websocket', 'polling'], // Explicitly allow both transports
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin: (origin, callback) => {
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
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'WebRTC signaling server is running',
    timestamp: new Date().toISOString(),
    socketio: 'ready'
  });
});

// Setup Socket.io handlers
setupSocket(io);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📡 Socket.io server ready for connections`);
  console.log(`🌐 Accessible from: http://localhost:${PORT} and your local network IP`);
});

