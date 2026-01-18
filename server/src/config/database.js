import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:changeme@localhost:27017/webrtc?authSource=admin';

let isConnected = false;

export const connectDatabase = async () => {
  if (isConnected) {
    console.log('✅ MongoDB already connected');
    return;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    isConnected = false;
    // Don't exit in production, let the app continue
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
};

export const disconnectDatabase = async () => {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('MongoDB disconnected');
  }
};
