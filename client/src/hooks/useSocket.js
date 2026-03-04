import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Dynamically determine socket URL based on current window location
const getSocketUrl = () => {
  // Use environment variable if set (for production/hosted server)
  if (import.meta.env.VITE_SOCKET_URL) {
    const url = import.meta.env.VITE_SOCKET_URL;
    console.log('🌐 Using configured socket URL from VITE_SOCKET_URL:', url);
    return url;
  }
  
  // Check if we're in production (not localhost)
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.') && !hostname.startsWith('10.') && !hostname.startsWith('172.');
  
  if (isProduction) {
    // In production without VITE_SOCKET_URL, show error
    console.error('❌ VITE_SOCKET_URL environment variable is not set!');
    console.error('   This is required in production. Please set it in your deployment platform.');
    console.error('   Current hostname:', hostname);
    console.error('   Example: VITE_SOCKET_URL=https://your-server.railway.app');
    // Still try to construct a URL, but it will likely fail
    const fallbackUrl = `${protocol}//${hostname}:3001`;
    console.warn('⚠️  Falling back to:', fallbackUrl, '(this will likely fail)');
    return fallbackUrl;
  }
  
  // Local development - use same host with port 3001
  const localUrl = `${protocol}//${hostname}:3001`;
  console.log('🌐 Using local socket URL:', localUrl);
  return localUrl;
};

const SOCKET_URL = getSocketUrl();

export function useSocket(guestToken = null, meetingId = null, userId = null) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔌 Attempting to connect to:', SOCKET_URL);
    console.log('🌐 Current origin:', window.location.origin);
    
    // Create socket connection
    // For Vercel/serverless: Use only polling (websockets don't work well with serverless)
    // For Railway/Render: Can use both polling and websocket
    const isVercel = SOCKET_URL.includes('vercel.app') || SOCKET_URL.includes('vercel.com');
    const isRailway = SOCKET_URL.includes('railway.app') || SOCKET_URL.includes('railway.xyz');
    const isRender = SOCKET_URL.includes('render.com') || SOCKET_URL.includes('onrender.com');
    
    // Use polling only for Vercel, both for Railway/Render/local
    const transports = isVercel ? ['polling'] : ['polling', 'websocket'];
    const upgrade = !isVercel; // Disable upgrade on Vercel
    
    // Prepare auth data for handshake
    const auth = {};
    if (guestToken) {
      auth.guestToken = guestToken;
      auth.meetingId = meetingId;
      console.log('🔐 Connecting as guest with meeting:', meetingId);
    } else if (userId) {
      auth.userId = userId;
      console.log('🔐 Connecting as registered user:', userId);
    }
    
    console.log('🔌 Socket configuration:', {
      url: SOCKET_URL,
      transports,
      upgrade,
      isVercel,
      isRailway,
      isRender,
      auth: guestToken ? 'guest' : userId ? 'user' : 'none',
    });
    
    const newSocket = io(SOCKET_URL, {
      transports, // Use only polling on Vercel, polling+websocket elsewhere
      upgrade, // Disable upgrade on Vercel
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      forceNew: false,
      autoConnect: true,
      withCredentials: true,
      auth, // Pass auth data in handshake
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      console.log('📡 Transport:', newSocket.io.engine.transport.name);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, try to reconnect manually
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err);
      console.error('Error details:', {
        message: err.message,
        type: err.type,
        description: err.description,
        data: err.data,
        transport: newSocket.io?.engine?.transport?.name,
      });
      
      // Don't show error if we're already connected or reconnecting
      // This prevents showing transient errors during reconnection
      if (isConnected || newSocket.io?.engine?.reconnecting) {
        console.log('🔄 Connection error during reconnection, ignoring...');
        return;
      }
      
      // More specific error messages
      let errorMessage = 'Failed to connect to server';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.type === 'TransportError' || err.message?.includes('xhr poll')) {
        // Only show error if not reconnecting
        if (!newSocket.io?.engine?.reconnecting) {
          errorMessage = 'Connection failed. Check if server is running and CORS is configured correctly.';
        } else {
          return; // Don't set error during reconnection
        }
      } else if (err.type === 'TimeoutError') {
        errorMessage = 'Connection timeout. Check if server is running on port 3001.';
      } else if (err.message?.includes('CORS')) {
        errorMessage = 'CORS error. Server may not be allowing your origin.';
      }
      
      setError(`Connection error: ${errorMessage}`);
      setIsConnected(false);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('reconnect_error', (err) => {
      console.error('❌ Reconnection error:', err);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
      setError('Failed to reconnect. Please refresh the page.');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  return { socket, isConnected, error };
}

