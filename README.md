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
   
   Create a `.env` file in the `server` directory:
   ```
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```
   
   Optionally, create a `.env` file in the `client` directory:
   ```
   VITE_SOCKET_URL=http://localhost:3001
   ```

## 🚀 Running the Application

### Start the Server

```bash
cd server
npm run dev
```

The server will start on `http://localhost:3001`

### Start the Client

```bash
cd client
npm run dev
```

The client will start on `http://localhost:5173`

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

## 🔒 Security Notes

- For production, use HTTPS (required for WebRTC)
- Implement authentication and authorization
- Add rate limiting to prevent abuse
- Validate and sanitize all user inputs

## 📚 Resources

- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.io Documentation](https://socket.io/docs/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 📄 License

ISC

