// MongoDB initialization script
// This runs when MongoDB container starts for the first time

// Switch to the webrtc database
db = db.getSiblingDB('webrtc');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'name', 'phone', 'password', 'status'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'must be a valid email address'
        },
        name: {
          bsonType: 'string',
          minLength: 2,
          description: 'must be a string with at least 2 characters'
        },
        phone: {
          bsonType: 'string',
          description: 'must be a string'
        },
        password: {
          bsonType: 'string',
          minLength: 8,
          description: 'must be a string with at least 8 characters'
        },
        isAdmin: {
          bsonType: 'bool',
          description: 'must be a boolean'
        },
        status: {
          enum: ['pending', 'approved', 'rejected', 'suspended'],
          description: 'must be one of the enum values'
        }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ status: 1 });
db.users.createIndex({ isAdmin: 1 });
db.users.createIndex({ createdAt: -1 });

// Create sessions collection
db.createCollection('sessions');

db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ token: 1 }, { unique: true });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print('✅ MongoDB initialization completed');
print('✅ Collections created: users, sessions');
print('✅ Indexes created');
