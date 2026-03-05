# WebRTC Video Calling App

A real-time video calling application built with React, Express, and WebRTC using shadcn/ui and Tailwind CSS.

## 🚀 Features

- ✅ Real-time video and audio calling
- ✅ Peer-to-peer communication using WebRTC
- ✅ Room-based video calls with unique room IDs
- ✅ Modern UI with shadcn/ui components
- ✅ Responsive design with Tailwind CSS
- ✅ Media controls (mute/unmute, video on/off)
- ✅ Connection status indicators
- ✅ Error handling and loading states
- ✅ Automatic room management

## 📁 Project Structure

```
webrtc/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   └── utils/        # WebRTC utilities
│   └── package.json
│
├── server/          # Express backend
│   ├── src/
│   │   ├── server.js     # Express server
│   │   └── socket.js     # Socket.io handlers
│   └── package.json
│
└── README.md
```

## 🛠️ Technology Stack

### Frontend
- React 19
- Vite
- shadcn/ui
- Tailwind CSS
- Socket.io-client

### Backend
- Express.js
- Socket.io
- CORS
- dotenv

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup

1. **Install client dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables:**
   
   **Server** - Create a `.env` file in the `server` directory:
   ```
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```
   
   **Client** - Create a `.env` file in the `client` directory:
   ```
   # For local development (optional - defaults to localhost:3001)
   VITE_SOCKET_URL=http://localhost:3001
   
   # For production (use your hosted server)
   # VITE_SOCKET_URL=https://video-call-app-server-faizer.vercel.app
   
   # Optional: TURN server for international/cross-network calls (see README section below)
   # VITE_TURN_URL=turn:your-turn.example.com:443
   # VITE_TURN_USERNAME=your-username
   # VITE_TURN_CREDENTIAL=your-credential
   ```
   
   **Note:** To use the hosted Vercel server, uncomment and use the production URL above.

## 🚀 Running the Application

### Local Testing (Recommended for Development)

**Terminal 1 - Start the Server:**
```bash
cd server
npm run dev
```

The server will start on `http://localhost:3001`

**Terminal 2 - Start the Client:**
```bash
cd client
npm run dev
```

The client will start on `http://localhost:5173` and connect to the local server.

**Test the app:**
1. Open `http://localhost:5173` in your browser
2. Open the same URL in another browser tab/window
3. Join the same room ID in both
4. You should see both video streams!

See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for detailed testing instructions.

### Option 2: Use Hosted Server

If you have a hosted server (e.g., on Vercel), you can use it directly:

1. **Create `.env` file in `client/` directory:**
   ```env
   VITE_SOCKET_URL=https://video-call-app-server-faizer.vercel.app
   ```

2. **Start the client:**
   ```bash
   cd client
   npm run dev
   ```

The client will connect to your hosted server automatically.

### Access from Local Network

The app is configured to be accessible from your local network IP address:

1. **Find your local IP address:**
   - Mac/Linux: Run `ifconfig` or `ip addr`
   - Windows: Run `ipconfig`
   - Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)

2. **Access the app:**
   - Open `http://YOUR_IP:5173` in your browser (e.g., `http://192.168.1.15:5173`)
   - The socket connection will automatically use the same IP address

3. **For multiple devices:**
   - Both devices must use the same IP address to connect
   - Example: Device 1 uses `http://192.168.1.15:5173`, Device 2 also uses `http://192.168.1.15:5173`

## 🎯 Usage

1. Open the application in your browser
2. Enter or create a room ID
3. Allow camera and microphone permissions
4. Share the room ID with another user
5. Start video calling!

### ⚠️ Important: HTTPS Requirement

WebRTC requires a **secure context** (HTTPS) to access camera and microphone. 

**For Development:**
- ✅ `http://localhost:5173` - Works (localhost is considered secure)
- ⚠️ `http://192.168.1.15:5173` - May not work (not a secure context)
- ✅ `https://localhost:5173` - Works (HTTPS)

**Solutions for Network Access:**
1. **Use localhost** - Access via `http://localhost:5173` on each device
2. **Set up HTTPS** - Use a reverse proxy (nginx) or tools like `mkcert` for local HTTPS
3. **Use a tunnel** - Services like ngrok can provide HTTPS tunnels

**Note:** Some browsers may allow WebRTC on local network IPs, but it's not guaranteed. For production, always use HTTPS.

## 🔧 Development

### Adding shadcn/ui Components

To add new shadcn/ui components:

```bash
cd client
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
```

## 📝 Implemented Features

- ✅ Video call UI components (VideoCall, VideoPlayer, Controls)
- ✅ WebRTC peer connection logic with hooks
- ✅ Media controls (mute/unmute, video toggle, end call)
- ✅ Error handling and loading states
- ✅ Connection status indicators
- ✅ Room joining and management
- ✅ Socket.io signaling server

## 🎯 Future Enhancements

- [ ] Screen sharing
- [ ] Multi-user support (3+ participants)
- [ ] Text chat during calls
- [ ] Recording capabilities
- [ ] Camera switching (front/back)
- [ ] Connection quality indicators
- [ ] User authentication
- [ ] Room password protection

## 🌍 International / cross-network calls (TURN)

Calls on the **same network** (e.g. same office Wi‑Fi) usually work with STUN only. When participants are in **different countries or networks** (different NATs/firewalls), peer-to-peer often fails and you see a black video box and "Connection failed… Retrying".

**Fix:** Use a **TURN server** to relay media when a direct path cannot be found.

1. **Get TURN credentials** (pick one):
   - **Metered.ca** – [Free tier](https://www.metered.ca/stun-turn) (sign up, then use their TURN URLs and credentials).
   - **Twilio** – [TURN (paid)](https://www.twilio.com/docs/stun-turn) – very reliable.
   - **Self-hosted** – Run [coturn](https://github.com/coturn/coturn) on your server.

2. **Configure the client** – In `client/.env` (or your build env), set:
   ```env
   VITE_TURN_URL=turn:your-turn-host:443,turn:your-turn-host:443?transport=tcp
   VITE_TURN_USERNAME=your-username
   VITE_TURN_CREDENTIAL=your-credential
   ```
   Then **rebuild** the client (`npm run build`). The app will use this TURN server first for ICE, so international/cross-network calls can connect via relay.

3. **Multiple URLs** – You can pass several TURN URLs in `VITE_TURN_URL` separated by commas (same username/credential used for all).

Without these env vars, the app falls back to free public TURN servers, which may be rate-limited or unreliable for cross-country use.

## 🔒 Security Notes

- For production, use HTTPS (required for WebRTC)
- Implement authentication and authorization
- Add rate limiting to prevent abuse
- Validate and sanitize all user inputs

## 🚀 Production Deployment

**⚠️ Important**: For production, use a platform that supports persistent WebSocket connections:

- **Recommended**: Railway, Render, or Fly.io (easy deployment, full WebSocket support)
- **Alternative**: Traditional VM/VPS (DigitalOcean, Linode, etc.)
- **Not ideal**: Vercel/Netlify (serverless limitations, polling only)

See [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) for detailed deployment guides.

## 📚 Resources

- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.io Documentation](https://socket.io/docs/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 📄 License

ISC

