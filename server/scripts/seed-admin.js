import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:changeme@localhost:27017/webrtc?authSource=admin';

async function seedAdmin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName = process.env.ADMIN_NAME || 'Admin User';
    const adminPhone = process.env.ADMIN_PHONE || '+1234567890';
    
    // Check if admin exists
    await User.deleteMany({
      email: adminEmail
    });
    const existingAdmin = await User.findByEmail(adminEmail);
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log(`   Email: ${adminEmail}`);
      process.exit(0);
    }
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = new User({
      email: adminEmail,
      name: adminName,
      phone: adminPhone,
      password: adminPassword,
      isAdmin: true,
      status: 'approved',
      approvedAt: new Date()
    });
    
    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log('');
    console.log('📋 Admin Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('⚠️  Please change the password after first login!');
    console.log('');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();
