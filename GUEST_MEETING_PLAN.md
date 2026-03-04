# Guest Meeting Links Feature - Implementation Plan

## Overview
Implement a Teams-like feature where registered users can create meeting links that can be shared with non-registered users. Guest users can join meetings by providing their name, and links expire after 1 hour.

---

## Feature Requirements

### Core Functionality
1. **Registered users** can create meeting links
2. **Guest users** (non-registered) can join meetings by providing a name
3. **Meeting links expire** after 1 hour from creation
4. **Shareable links** with unique meeting IDs
5. **Guest users** can only access the meeting room, not other app features

---

## Technical Architecture

### Phase 1: Database Schema & Models

#### 1.1 Meeting Model (`server/src/models/Meeting.js`)
```javascript
Schema Fields:
- meetingId: String (unique, indexed) - Short unique ID for URL
- roomId: String (indexed) - WebRTC room identifier
- createdBy: ObjectId (ref: User) - Registered user who created the meeting
- title: String (optional) - Meeting title
- expiresAt: Date (indexed) - Expiry timestamp (createdAt + 1 hour)
- guestAccessEnabled: Boolean (default: true)
- status: String (enum: ['active', 'expired', 'ended']) - default: 'active'
  
  // Registered user participants (users who joined via their account)
  registeredParticipants: Array of {
    userId: ObjectId (ref: User),
    socketId: String,
    joinedAt: Date,
    leftAt: Date (optional)
  }
  
  // Guest participants (non-registered users)
  guestParticipants: Array of {
    name: String,
    socketId: String,
    joinedAt: Date,
    leftAt: Date (optional),
    ipAddress: String (optional, for abuse prevention)
  }
  
  // Combined participant count (for quick access)
  participantCount: Number (default: 0)
  
- createdAt: Date
- updatedAt: Date

Indexes:
- meetingId (unique)
- roomId
- expiresAt (TTL index for auto-cleanup)
- createdBy
- status
- "registeredParticipants.userId"
- "registeredParticipants.socketId"
- "guestParticipants.socketId"
```

**Participant Tracking Methods:**
```javascript
// Add registered user participant
meeting.addRegisteredParticipant(userId, socketId)

// Add guest participant
meeting.addGuestParticipant(guestName, socketId, ipAddress)

// Remove participant (by socketId - works for both types)
meeting.removeParticipant(socketId)

// Get all participants (combined)
meeting.getAllParticipants() // Returns array with type indicator

// Get participant count
meeting.getParticipantCount() // Returns total count
```

#### 1.2 Guest Session Model (Optional - for tracking)
```javascript
Schema Fields:
- meetingId: ObjectId (ref: Meeting)
- guestName: String
- socketId: String
- joinedAt: Date
- leftAt: Date
- ipAddress: String (optional, for abuse prevention)
```

---

### Phase 2: Backend API Endpoints

#### 2.1 Meeting Routes (`server/src/routes/meetings.js`)

**POST `/api/meetings`** - Create meeting link
- **Auth:** Required (authenticated users only)
- **Body:** `{ title?: string }`
- **Response:** 
  ```json
  {
    success: true,
    data: {
      meetingId: "abc123xyz",
      roomId: "room-abc123xyz",
      shareableLink: "https://synchro.ai21.ca/join/abc123xyz",
      expiresAt: "2026-02-18T15:30:00Z",
      expiresIn: 3600 // seconds
    }
  }
  ```

**GET `/api/meetings/:meetingId`** - Validate meeting link
- **Auth:** Not required (public endpoint)
- **Response:**
  ```json
  {
    success: true,
    data: {
      meetingId: "abc123xyz",
      roomId: "room-abc123xyz",
      title: "Team Standup",
      expiresAt: "2026-02-18T15:30:00Z",
      isExpired: false,
      canJoin: true,
      participantCount: 3,
      createdBy: {
        name: "John Doe",
        email: "john@example.com"
      }
    }
  }
  ```
- **Errors:** 404 (not found), 410 (expired)

**GET `/api/meetings/:meetingId/participants`** - Get meeting participants (for host)
- **Auth:** Required (only meeting creator)
- **Response:**
  ```json
  {
    success: true,
    data: {
      meetingId: "abc123xyz",
      participantCount: 3,
      registeredParticipants: [
        {
          userId: "user123",
          name: "John Doe",
          email: "john@example.com",
          socketId: "socket123",
          joinedAt: "2026-02-18T14:30:00Z"
        }
      ],
      guestParticipants: [
        {
          name: "Jane Guest",
          socketId: "socket456",
          joinedAt: "2026-02-18T14:35:00Z"
        },
        {
          name: "Bob Guest",
          socketId: "socket789",
          joinedAt: "2026-02-18T14:40:00Z"
        }
      ]
    }
  }
  ```

**POST `/api/meetings/:meetingId/join`** - Guest join validation
- **Auth:** Not required
- **Body:** `{ guestName: string }` (min 2 chars, max 50 chars)
- **Response:**
  ```json
  {
    success: true,
    data: {
      meetingId: "abc123xyz",
      roomId: "room-abc123xyz",
      guestName: "Jane Guest",
      token: "guest-jwt-token" // Short-lived token for socket auth
    }
  }
  ```
- **Rate Limiting:** 5 attempts per IP per 15 minutes

**GET `/api/meetings`** - List user's meetings
- **Auth:** Required
- **Query:** `?status=active|expired|all`
- **Response:** Array of user's meetings

**DELETE `/api/meetings/:meetingId`** - End meeting early
- **Auth:** Required (only creator)
- **Response:** Success message

#### 2.2 Meeting Controller (`server/src/controllers/meetingController.js`)

Functions:
- `createMeeting(req, res)` - Create new meeting
- `getMeeting(req, res)` - Get meeting details (public)
- `validateGuestJoin(req, res)` - Validate guest can join
- `getUserMeetings(req, res)` - List user's meetings
- `getMeetingParticipants(req, res)` - Get all participants (registered + guests) for meeting creator
- `endMeeting(req, res)` - End meeting early
- `cleanupExpiredMeetings()` - Background job (optional)

**Helper Functions:**
- `addRegisteredParticipant(meetingId, userId, socketId)` - Add registered user to meeting
- `addGuestParticipant(meetingId, guestName, socketId, ipAddress)` - Add guest to meeting
- `removeParticipant(meetingId, socketId)` - Remove participant (works for both types)
- `getParticipantCount(meetingId)` - Get total participant count

---

### Phase 3: Socket.io Integration

#### 3.1 Guest Authentication Middleware (`server/src/middleware/socketAuth.js`)
```javascript
// Socket.io middleware to authenticate guests
io.use(async (socket, next) => {
  const { meetingId, guestToken, userId } = socket.handshake.auth;
  
  if (guestToken) {
    // Validate guest token
    const guest = await validateGuestToken(guestToken);
    if (guest && !guest.isExpired) {
      socket.guestInfo = guest;
      socket.isGuest = true;
      return next();
    }
  }
  
  if (userId) {
    // Regular user authentication (existing flow)
    // ... existing auth logic
  }
  
  next(new Error('Authentication failed'));
});
```

#### 3.2 Socket Event Updates (`server/src/socket.js`)

**Modified Events:**
- `join-room` - Accept `{ roomId, userId?, guestName?, meetingId? }`
  - If `meetingId` provided, validate expiry and guest access
  - If `userId` provided (registered user):
    - Add to `meeting.registeredParticipants` array
    - Store: `{ userId, socketId, joinedAt }`
  - If `guestName` provided (guest user):
    - Add to `meeting.guestParticipants` array
    - Store: `{ name, socketId, joinedAt, ipAddress }`
  - Update `meeting.participantCount`
  - Save meeting document

- `leave-room` - Accept `{ roomId, meetingId? }`
  - If `meetingId` provided:
    - Remove participant from appropriate array (registered or guest) by `socketId`
    - Update `meeting.participantCount`
    - Set `leftAt` timestamp
    - Save meeting document

**Participant Tracking Logic:**
```javascript
socket.on('join-room', async ({ roomId, userId, guestName, meetingId }) => {
  if (meetingId) {
    const meeting = await Meeting.findOne({ meetingId });
    
    if (userId) {
      // Registered user joining
      meeting.registeredParticipants.push({
        userId,
        socketId: socket.id,
        joinedAt: new Date()
      });
    } else if (guestName) {
      // Guest user joining
      meeting.guestParticipants.push({
        name: guestName,
        socketId: socket.id,
        joinedAt: new Date(),
        ipAddress: socket.handshake.address
      });
    }
    
    meeting.participantCount = 
      meeting.registeredParticipants.length + 
      meeting.guestParticipants.length;
    
    await meeting.save();
  }
  
  // ... rest of join-room logic
});

socket.on('disconnect', async () => {
  // Find and remove from meeting by socketId
  const meeting = await Meeting.findOne({
    $or: [
      { 'registeredParticipants.socketId': socket.id },
      { 'guestParticipants.socketId': socket.id }
    ]
  });
  
  if (meeting) {
    // Remove from registered participants
    const regIndex = meeting.registeredParticipants.findIndex(
      p => p.socketId === socket.id
    );
    if (regIndex !== -1) {
      meeting.registeredParticipants[regIndex].leftAt = new Date();
      meeting.registeredParticipants.splice(regIndex, 1);
    }
    
    // Remove from guest participants
    const guestIndex = meeting.guestParticipants.findIndex(
      p => p.socketId === socket.id
    );
    if (guestIndex !== -1) {
      meeting.guestParticipants[guestIndex].leftAt = new Date();
      meeting.guestParticipants.splice(guestIndex, 1);
    }
    
    meeting.participantCount = 
      meeting.registeredParticipants.length + 
      meeting.guestParticipants.length;
    
    await meeting.save();
  }
});
```

**Room Update Events:**
- Emit participant list with type indicator:
  ```javascript
  socket.emit('room-update', {
    participantCount: totalCount,
    registeredParticipants: [...], // Array of { userId, name, socketId }
    guestParticipants: [...], // Array of { name, socketId }
    otherParticipants: [...], // Combined array with type: 'registered' | 'guest'
  });
  ```

---

### Phase 4: Frontend Implementation

#### 4.1 New Routes (`client/src/App.jsx`)
```javascript
// Public route for guest join
<Route path="/join/:meetingId" element={<GuestJoin />} />

// Protected route for creating meetings
<Route path="/meetings/create" element={<CreateMeeting />} />
```

#### 4.2 Create Meeting Component (`client/src/pages/CreateMeeting.jsx`)
**Features:**
- Form to create meeting (optional title)
- Display shareable link with copy button
- Show expiry countdown timer
- List of user's active meetings
- "End Meeting" button for active meetings

**UI Elements:**
- Input for meeting title (optional)
- "Create Meeting" button
- Shareable link display with copy/share buttons
- Countdown timer showing time until expiry
- QR code for link (optional enhancement)

#### 4.3 Guest Join Component (`client/src/pages/GuestJoin.jsx`)
**Features:**
- Extract `meetingId` from URL params
- Fetch meeting details (validate expiry)
- Form for guest name input
- Join button that validates and redirects to call
- Error handling for expired/invalid links

**UI Elements:**
- Meeting title display
- Host name display
- Guest name input field
- "Join as Guest" button
- Expiry warning if < 15 minutes remaining
- Error messages for expired/invalid links

#### 4.4 VideoCall Component Updates (`client/src/components/VideoCall.jsx`)

**Changes:**
- Support guest mode (no authentication required)
- Display guest name instead of user name
- Handle guest token in socket connection
- Show participant list with user type badges (Registered/Guest)
- Guest users see limited UI (no profile, no admin features)
- Track and display both registered and guest participants

**Participant Display:**
```javascript
// Participant data structure from socket events
const participants = [
  {
    socketId: "socket123",
    type: "registered", // or "guest"
    name: "John Doe", // User name or guest name
    userId: "user123", // Only for registered users
    email: "john@example.com" // Only for registered users
  },
  {
    socketId: "socket456",
    type: "guest",
    name: "Jane Guest"
  }
];

// Display logic
participants.map(p => (
  <ParticipantBadge 
    name={p.name}
    type={p.type} // Shows "Registered" or "Guest" badge
    isGuest={p.type === "guest"}
  />
));
```

**Guest Mode Detection:**
```javascript
const isGuest = !user && guestToken;
const displayName = isGuest ? guestName : user?.name;

// When joining room, include participant type
socket.emit('join-room', {
  roomId,
  userId: user?.id, // Only if registered user
  guestName: isGuest ? guestName : undefined, // Only if guest
  meetingId: meetingId // If joining via meeting link
});
```

#### 4.5 Socket Hook Updates (`client/src/hooks/useSocket.js`)

**Changes:**
- Support guest authentication
- Pass `guestToken` and `meetingId` in handshake if guest
- Handle guest-specific socket events

---

### Phase 5: API Service Updates

#### 5.1 Meeting API (`client/src/services/api.js`)
```javascript
export const meetingAPI = {
  createMeeting: (data) => api.post('/api/meetings', data),
  getMeeting: (meetingId) => api.get(`/api/meetings/${meetingId}`),
  joinAsGuest: (meetingId, guestName) => 
    api.post(`/api/meetings/${meetingId}/join`, { guestName }),
  getUserMeetings: (params) => api.get('/api/meetings', { params }),
  getMeetingParticipants: (meetingId) => 
    api.get(`/api/meetings/${meetingId}/participants`),
  endMeeting: (meetingId) => api.delete(`/api/meetings/${meetingId}`),
};
```

---

### Phase 6: Security & Validation

#### 6.1 Rate Limiting
- Guest join attempts: 5 per IP per 15 minutes
- Meeting creation: 10 per user per hour
- Use `express-rate-limit` with IP-based tracking

#### 6.2 Input Validation
- Guest name: 2-50 characters, alphanumeric + spaces
- Meeting title: max 100 characters
- Meeting ID: URL-safe, 8-12 characters

#### 6.3 Expiry Validation
- Check expiry on every join attempt
- Cleanup expired meetings (background job or on-access)
- Show clear error messages for expired links

#### 6.4 Abuse Prevention
- Track IP addresses for guest joins
- Limit concurrent guests per meeting (optional: max 50)
- Monitor for spam/abuse patterns

---

### Phase 7: UI/UX Enhancements

#### 7.1 Meeting Link Display
- Copy button with toast notification
- Share button (Web Share API + clipboard fallback)
- QR code generation (optional)
- Expiry countdown with visual indicator

#### 7.2 Guest Join Flow
- Clean, simple UI focused on joining
- Show meeting host name
- Show time remaining until expiry
- Clear error messages

#### 7.3 Video Call UI Updates
- Participant badges (Registered/Guest)
- Guest name display
- Limited controls for guests (no profile access)

---

## Implementation Steps

### Step 1: Database & Models
1. Create `Meeting` model
2. Add indexes and TTL for auto-cleanup
3. Create migration script if needed

### Step 2: Backend API
1. Create meeting routes
2. Implement meeting controller
3. Add validation middleware
4. Add rate limiting
5. Test API endpoints

### Step 3: Socket.io Updates
1. Add guest authentication middleware
2. Update socket events for guest support
3. Track guest participants separately
4. Test socket events

### Step 4: Frontend - Create Meeting
1. Create `CreateMeeting` component
2. Add route
3. Implement API integration
4. Add share/copy functionality
5. Add countdown timer

### Step 5: Frontend - Guest Join
1. Create `GuestJoin` component
2. Add route with `meetingId` param
3. Implement meeting validation
4. Add guest name form
5. Handle redirect to call

### Step 6: Frontend - VideoCall Updates
1. Add guest mode support
2. Update socket connection for guests
3. Display guest names
4. Add participant type badges
5. Limit guest UI features

### Step 7: Testing & Polish
1. Test meeting creation flow
2. Test guest join flow
3. Test expiry handling
4. Test concurrent guests
5. Test rate limiting
6. UI/UX polish

---

## Database Migration

### MongoDB Indexes
```javascript
// Meeting collection indexes
db.meetings.createIndex({ meetingId: 1 }, { unique: true });
db.meetings.createIndex({ roomId: 1 });
db.meetings.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
db.meetings.createIndex({ createdBy: 1 });
db.meetings.createIndex({ status: 1 });
db.meetings.createIndex({ "registeredParticipants.userId": 1 });
db.meetings.createIndex({ "registeredParticipants.socketId": 1 });
db.meetings.createIndex({ "guestParticipants.socketId": 1 });
```

---

## Environment Variables

### New Variables
```env
# Meeting configuration
MEETING_EXPIRY_HOURS=1
MEETING_ID_LENGTH=10
MAX_GUESTS_PER_MEETING=50

# Guest token
GUEST_TOKEN_SECRET=your-secret-key
GUEST_TOKEN_EXPIRES_IN=2h # Token valid for 2 hours
```

---

## File Structure

```
server/
├── src/
│   ├── models/
│   │   └── Meeting.js (NEW)
│   ├── controllers/
│   │   └── meetingController.js (NEW)
│   ├── routes/
│   │   └── meetings.js (NEW)
│   ├── middleware/
│   │   └── socketAuth.js (NEW)
│   └── socket.js (MODIFY)

client/
├── src/
│   ├── pages/
│   │   ├── CreateMeeting.jsx (NEW)
│   │   └── GuestJoin.jsx (NEW)
│   ├── components/
│   │   └── VideoCall.jsx (MODIFY)
│   ├── hooks/
│   │   └── useSocket.js (MODIFY)
│   └── services/
│       └── api.js (MODIFY)
```

---

## Testing Checklist

### Backend
- [ ] Create meeting endpoint works
- [ ] Meeting validation endpoint works
- [ ] Guest join endpoint validates correctly
- [ ] Expiry validation works
- [ ] Rate limiting works
- [ ] Socket.io guest authentication works
- [ ] Registered participants tracked correctly in Meeting model
- [ ] Guest participants tracked correctly in Meeting model
- [ ] Participant removal works for both types
- [ ] Participant count updates correctly
- [ ] Get participants endpoint returns both registered and guest participants

### Frontend
- [ ] Create meeting UI works
- [ ] Shareable link generation works
- [ ] Copy/share buttons work
- [ ] Countdown timer works
- [ ] Guest join page loads correctly
- [ ] Guest name validation works
- [ ] Guest can join call
- [ ] Registered user can join meeting via link
- [ ] Guest names display correctly
- [ ] Registered user names display correctly
- [ ] Participant type badges display correctly (Registered/Guest)
- [ ] Expired link shows error
- [ ] Guest UI limitations work
- [ ] Participant list shows both types correctly

### Integration
- [ ] Registered user creates meeting
- [ ] Registered user joins their own meeting
- [ ] Another registered user joins via link
- [ ] Guest receives link and joins
- [ ] Multiple guests can join same meeting
- [ ] Mixed participants (registered + guests) can all see each other
- [ ] Participant tracking persists correctly in database
- [ ] Meeting expires after 1 hour
- [ ] Expired link cannot be used
- [ ] Participant count is accurate for both types

---

## Future Enhancements (Optional)

1. **Meeting Scheduling** - Schedule meetings for future times
2. **Meeting Recording** - Record meetings (requires storage)
3. **Meeting Password** - Optional password protection
4. **Waiting Room** - Host can approve guests before joining
5. **Screen Sharing** - Enhanced for guests
6. **Chat** - Text chat during meetings
7. **Meeting History** - View past meetings
8. **Analytics** - Track meeting usage and guest joins

---

## Notes

- **Meeting ID Generation**: Use crypto-safe random generation (e.g., `crypto.randomBytes(6).toString('base64url')`)
- **Expiry Handling**: Use MongoDB TTL index for automatic cleanup, but also validate on access
- **Guest Tokens**: Short-lived JWT tokens (2 hours) for socket authentication
- **Room ID**: Can reuse existing room system, just add meeting validation layer
- **Backward Compatibility**: Existing room join flow should continue to work for registered users

---

## Questions to Consider

1. Should guests be able to create their own rooms? (Probably not)
2. Should there be a limit on number of guests per meeting?
3. Should meetings be reusable or one-time use?
4. Should hosts be able to kick guests?
5. Should there be meeting history/analytics?

---

## Estimated Implementation Time

- **Phase 1 (Database)**: 2-3 hours
- **Phase 2 (Backend API)**: 4-5 hours
- **Phase 3 (Socket.io)**: 3-4 hours
- **Phase 4 (Frontend)**: 6-8 hours
- **Phase 5 (API Service)**: 1 hour
- **Phase 6 (Security)**: 2-3 hours
- **Phase 7 (UI/UX)**: 2-3 hours
- **Testing & Bug Fixes**: 3-4 hours

**Total: ~23-31 hours**

---

This plan provides a comprehensive roadmap for implementing guest meeting links with expiry. Each phase builds on the previous one, ensuring a systematic implementation approach.
