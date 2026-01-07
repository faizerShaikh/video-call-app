# 🚀 Complete Deployment Guide

## ⚠️ Why Vercel Doesn't Work Well

**Vercel is serverless** - it doesn't support persistent WebSocket connections, which WebRTC signaling requires. While the app can work with polling-only mode, it has:
- ❌ Higher latency
- ❌ Connection timeouts
- ❌ Less reliable for real-time communication
- ❌ Execution time limits

## ✅ Recommended: Railway (Easiest & Best)

Railway is the easiest platform that fully supports WebSockets. Here's how to deploy:

### Step 1: Deploy Server to Railway

1. **Sign up**: Go to https://railway.app and sign up with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add Service**:
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Railway will detect it's a Node.js app

4. **Configure Service**:
   - **Root Directory**: `server` ⚠️ **IMPORTANT: Set this!**
   - **Build Command**: Leave **EMPTY** (Railway will auto-run `npm install`)
   - **Start Command**: `npm start`
   
   **OR** if build fails, try:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. **Set Environment Variables** (in Railway dashboard):
   ```
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://your-client-domain.vercel.app
   ```
   (You'll update CORS_ORIGIN after deploying the client)

6. **Deploy**: Railway will automatically deploy. Wait for it to finish.

7. **Get Your Server URL**: 
   - Railway provides a URL like: `https://your-app-name.up.railway.app`
   - Copy this URL - you'll need it for the client

### Step 2: Deploy Client to Vercel

1. **Go to Vercel Dashboard**: https://vercel.com

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository

3. **Configure Project**:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Set Environment Variables**:
   - Click "Environment Variables"
   - Add: `VITE_SOCKET_URL` = `https://your-app-name.up.railway.app`
   - (Use the Railway server URL from Step 1)

5. **Deploy**: Click "Deploy"

6. **Get Your Client URL**: 
   - Vercel provides a URL like: `https://your-client.vercel.app`
   - Copy this URL

### Step 3: Update Server CORS

1. **Go back to Railway**:
   - Open your server service
   - Go to "Variables" tab
   - Update `CORS_ORIGIN` to include your client URL:
     ```
     CORS_ORIGIN=https://your-client.vercel.app,https://your-client.vercel.app
     ```
   - Railway will automatically redeploy

### Step 4: Test

1. Open your client URL in a browser
2. Open browser console (F12)
3. You should see: `✅ Socket connected:`
4. Try joining a room and test video calling

## 🔄 Alternative: Render (Also Good)

If you prefer Render:

### Deploy Server to Render

1. **Sign up**: https://render.com

2. **New Web Service**:
   - Connect your GitHub repository
   - **Name**: `webrtc-server`
   - **Environment**: Node
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://your-client.vercel.app
   ```

4. **Deploy**: Click "Create Web Service"

5. **Get URL**: Render provides: `https://your-app.onrender.com`

### Deploy Client to Vercel

Same as Step 2 above, but use Render URL for `VITE_SOCKET_URL`

## 📋 Quick Checklist

- [ ] Server deployed to Railway/Render
- [ ] Server URL copied
- [ ] Client deployed to Vercel
- [ ] `VITE_SOCKET_URL` set in Vercel environment variables
- [ ] `CORS_ORIGIN` updated in Railway/Render with client URL
- [ ] Tested connection in browser console
- [ ] Tested video calling with 2+ participants

## 🐛 Troubleshooting

### Connection Issues

1. **Check Environment Variables**:
   - Server: `CORS_ORIGIN` must include your client URL
   - Client: `VITE_SOCKET_URL` must be your server URL

2. **Check Server Logs**:
   - Railway: Go to "Deployments" → Click latest → View logs
   - Render: Go to "Events" tab

3. **Test Server Health**:
   ```bash
   curl https://your-server-url.com/health
   ```
   Should return JSON with status: "ok"

4. **Browser Console**:
   - Check for CORS errors
   - Check for connection errors
   - Should see: `✅ Socket connected:`

### WebRTC Issues

1. **HTTPS Required**: Both client and server must use HTTPS
2. **Check Browser Permissions**: Allow camera/microphone access
3. **STUN/TURN**: May need additional TURN servers for some networks

## 🎯 Recommended Setup Summary

**Best for Production:**
- **Server**: Railway or Render (full WebSocket support)
- **Client**: Vercel (great for static sites)

**Why This Works:**
- Railway/Render: Persistent connections, full WebSocket support
- Vercel: Perfect for React apps, fast CDN, automatic HTTPS
- Together: Best of both worlds!

## 📝 Environment Variables Reference

### Server (Railway/Render)
```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-client.vercel.app
```

### Client (Vercel)
```env
VITE_SOCKET_URL=https://your-server.railway.app
```

## 🚀 Quick Deploy Commands

### Railway CLI (Optional)
```bash
npm i -g @railway/cli
railway login
cd server
railway init
railway up
```

### Manual Deploy
Just use the Railway/Render web interface - it's easier!

---

**Need Help?** Check the console logs and server logs for detailed error messages.

