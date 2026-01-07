# Local Testing Guide

## 🧪 Testing the WebRTC Video Calling App Locally

You can test the app completely locally without any deployment. Here's how:

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A webcam and microphone
- Two browser windows/tabs (or two devices on the same network)

## 🚀 Quick Start

### Step 1: Install Dependencies

**Terminal 1 - Server:**
```bash
cd server
npm install
```

**Terminal 2 - Client:**
```bash
cd client
npm install
```

### Step 2: Start the Server

**Terminal 1:**
```bash
cd server
npm run dev
```

You should see:
```
🚀 Server running on http://0.0.0.0:3001
📡 Socket.io server ready for connections
🌐 Accessible from: http://localhost:3001 and your local network IP
```

### Step 3: Start the Client

**Terminal 2:**
```bash
cd client
npm run dev
```

You should see:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.15:5173/
```

### Step 4: Test the App

1. **Open browser**: Go to `http://localhost:5173`
2. **Allow permissions**: Grant camera and microphone access
3. **Join a room**: 
   - Enter a room ID (e.g., "test123")
   - Click "Join Room"
4. **Open second window/tab**: 
   - Go to `http://localhost:5173` in a new tab
   - Enter the same room ID
   - Click "Join Room"
5. **You should see**: Both video streams!

## 🧪 Testing Scenarios

### Scenario 1: Same Computer (Two Browser Tabs)

1. Open `http://localhost:5173` in Chrome
2. Open `http://localhost:5173` in Firefox (or another Chrome tab)
3. Use the same room ID in both
4. You should see both videos

### Scenario 2: Same Network (Two Devices)

1. Find your local IP:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
   Example: `192.168.1.15`

2. **Device 1** (your computer):
   - Open `http://localhost:5173`
   - Join room "test123"

3. **Device 2** (phone/tablet/another computer):
   - Open `http://192.168.1.15:5173` (use your IP)
   - Join room "test123"

4. Both should see each other's video!

### Scenario 3: Test Controls

- ✅ Toggle video on/off
- ✅ Mute/unmute audio
- ✅ Check connection status indicator
- ✅ Test leaving and rejoining rooms

## 🔍 Debugging

### Check Server Logs

In Terminal 1 (server), you should see:
```
✅ User connected: abc123
👤 User user-xyz joining room test123
📊 Room test123 now has 1 participant(s)
📤 Offer from abc123 to all in room test123
📥 Answer from def456 to abc123 in room test123
```

### Check Browser Console

Open DevTools (F12) and look for:
```
🔌 Attempting to connect to: http://localhost:3001
✅ Socket connected: abc123
📡 Transport: polling
🚪 Joining room: test123
📤 Creating and sending offer...
📥 Received offer from: def456
✅ Remote description set
📹 Received remote track
```

### Common Issues

#### Issue: "Connection error: xhr poll error"
**Solution**: 
- Make sure server is running on port 3001
- Check if port 3001 is blocked by firewall
- Try `http://localhost:3001/health` in browser

#### Issue: "Cannot read properties of undefined (reading 'getUserMedia')"
**Solution**:
- Use `http://localhost:5173` (not IP address)
- Localhost is considered a secure context
- Grant camera/microphone permissions

#### Issue: No remote video
**Solution**:
- Check browser console for errors
- Verify both users are in the same room (case-sensitive before normalization)
- Check server logs for offer/answer exchange
- Make sure both users granted camera permissions

#### Issue: "Connection state: failed"
**Solution**:
- Check if both users are on the same network
- Try refreshing both browsers
- Check firewall settings

## 🛠️ Testing Tools

### Test Server Health
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "message": "WebRTC signaling server is running",
  "timestamp": "2025-12-31T...",
  "socketio": "ready"
}
```

### Test Socket.io Connection
Open browser console and run:
```javascript
// Test if socket is connected
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

### Network Tab
1. Open DevTools → Network tab
2. Filter by "WS" or "polling"
3. Look for requests to `http://localhost:3001/socket.io/`
4. Status should be 200 (polling) or 101 (websocket upgrade)

## 📝 Testing Checklist

- [ ] Server starts without errors
- [ ] Client starts without errors
- [ ] Can connect to server (green indicator)
- [ ] Can join a room
- [ ] Local video shows
- [ ] Remote video shows (in second tab/device)
- [ ] Audio works (test with headphones)
- [ ] Video toggle works
- [ ] Audio mute/unmute works
- [ ] Connection status shows "connected"
- [ ] Can leave and rejoin rooms
- [ ] Multiple participants can join same room

## 🎯 Quick Test Script

```bash
# Terminal 1 - Start server
cd server && npm run dev

# Terminal 2 - Start client
cd client && npm run dev

# Then:
# 1. Open http://localhost:5173 in Chrome
# 2. Open http://localhost:5173 in Firefox
# 3. Both join room "test"
# 4. You should see both videos!
```

## 💡 Tips

1. **Use different browsers** for testing (Chrome + Firefox) to avoid conflicts
2. **Check browser console** for detailed logs
3. **Use simple room IDs** like "1" or "test" for easy testing
4. **Test on same network** first, then try different networks
5. **Use headphones** to avoid audio feedback

## 🐛 Troubleshooting

If something doesn't work:

1. **Check both terminals** for error messages
2. **Check browser console** (F12) for errors
3. **Verify ports are free**:
   ```bash
   # Check if port 3001 is in use
   lsof -i :3001
   
   # Check if port 5173 is in use
   lsof -i :5173
   ```
4. **Restart both server and client**
5. **Clear browser cache** and hard refresh (Ctrl+Shift+R)

## ✅ Success Indicators

You'll know it's working when:
- ✅ Both browser tabs show "Connected to server" (green)
- ✅ Both show participant count: "2 participants in room"
- ✅ Both show local video (your camera)
- ✅ Both show remote video (other person's camera)
- ✅ Connection status shows "connected" (green dot)
- ✅ Audio works (can hear each other)

Happy testing! 🎉

