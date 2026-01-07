# Quick Start Guide - Local Testing

## 🚀 Test Locally in 3 Steps

### 1. Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies (in a new terminal)
cd ../server
npm install
```

### 2. Set Up Environment Variables

**Server (.env file in `server/` directory):**
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Client (optional .env file in `client/` directory):**
```env
VITE_SOCKET_URL=http://localhost:3001
```

### 3. Run the Application

**Terminal 1 - Start the Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Start the Client:**
```bash
cd client
npm run dev
```

### 4. Test the App

1. Open `http://localhost:5173` in your browser
2. Click the 🎲 button to generate a room ID (or enter one manually)
3. Click "Join Room"
4. Allow camera and microphone permissions
5. Open another browser tab/window and join the same room
6. You should see both video streams!

## 🎯 Features to Try

- **Toggle Video**: Click the camera button to turn video on/off
- **Toggle Audio**: Click the microphone button to mute/unmute
- **End Call**: Click the red phone button to leave the room
- **Connection Status**: Watch the connection indicator (green = connected)

## 🐛 Troubleshooting

### Camera/Microphone Not Working
- Make sure you've granted browser permissions
- Check if other apps are using your camera/mic
- Try refreshing the page

### Connection Issues
- Ensure the server is running on port 3001
- Check browser console for errors
- Verify both users are in the same room

### No Remote Video
- Check connection status indicator
- Make sure both users have joined the room
- Try refreshing and rejoining

## 📝 Notes

- The app works best with Chrome, Firefox, or Edge
- HTTPS is required in production (WebRTC requirement)
- For localhost, HTTP works fine for development

