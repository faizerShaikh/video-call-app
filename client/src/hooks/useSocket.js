import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Dynamically determine socket URL based on current window location
const getSocketUrl = () => {
  // Use environment variable if set
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // Otherwise, use the same host as the current page but port 3001
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${hostname}:3001`;
};

const SOCKET_URL = getSocketUrl();

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔌 Attempting to connect to:', SOCKET_URL);
    
    // Create socket connection with fallback transports
    // Try polling first as it's more reliable across networks, then upgrade to websocket
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      upgrade: true, // Allow upgrade from polling to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
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
      });
      
      // More specific error messages
      let errorMessage = 'Failed to connect to server';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.type === 'TransportError') {
        errorMessage = 'WebSocket connection failed. Trying polling...';
      } else if (err.type === 'TimeoutError') {
        errorMessage = 'Connection timeout. Check if server is running.';
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

