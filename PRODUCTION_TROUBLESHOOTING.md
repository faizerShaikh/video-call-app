# 🔧 Production Troubleshooting Guide

If your app works locally but not in production, follow these steps:

## ✅ Step 1: Check Environment Variables

### Client (Vercel/Netlify/etc.)

**Required Environment Variable:**
```
VITE_SOCKET_URL=https://your-server.railway.app
```

**How to set in Vercel:**
1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add: `VITE_SOCKET_URL` = `https://your-server.railway.app`
4. Redeploy your application

**How to check:**
- Open browser console on your deployed app
- Look for: `🌐 Using configured socket URL from VITE_SOCKET_URL: ...`
- If you see: `❌ VITE_SOCKET_URL environment variable is not set!` → **Fix this first!**

### Server (Railway/Render/etc.)

**Required Environment Variables:**
```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-client.vercel.app
```

**Important:** `CORS_ORIGIN` must include your client's production URL (the one users visit).

## ✅ Step 2: Verify CORS Configuration

1. **Check Server Logs:**
   - Look for: `🌐 Checking origin: https://your-client.vercel.app`
   - Should see: `✅ Origin allowed: ...`
   - If you see: `❌ Origin not allowed: ...` → CORS is blocking!

2. **Fix CORS:**
   - In Railway/Render, update `CORS_ORIGIN` to include your client URL
   - Format: `CORS_ORIGIN=https://client1.vercel.app,https://client2.vercel.app`
   - Redeploy server after updating

## ✅ Step 3: Check Socket.io Connection

**In Browser Console, look for:**
- ✅ `✅ Socket connected: [socket-id]` → **Good!**
- ❌ `❌ Socket connection error: ...` → **Problem!**

**Common Socket.io Errors:**

### Error: "xhr poll error"
- **Cause:** CORS issue or server not accessible
- **Fix:** 
  1. Check `CORS_ORIGIN` includes your client URL
  2. Verify server is running and accessible
  3. Check server logs for CORS rejections

### Error: "Connection timeout"
- **Cause:** Server URL is wrong or server is down
- **Fix:**
  1. Verify `VITE_SOCKET_URL` is correct
  2. Test server URL in browser: `https://your-server.railway.app/health`
  3. Should return: `{"status":"ok",...}`

### Error: "TransportError"
- **Cause:** WebSocket upgrade failed (common on Railway)
- **Fix:** Already handled - client will fallback to polling

## ✅ Step 4: Check WebRTC Connection

**In Browser Console, look for:**
- ✅ `✅ ICE connection established with ...` → **Good!**
- ❌ `❌ ICE connection failed with ...` → **Problem!**

**Common WebRTC Issues:**

### Issue: "Connection stuck in 'checking' state"
- **Cause:** NAT/firewall blocking direct connection
- **Fix:** TURN servers are already configured, but may need better ones
- **Check:** Look for `Candidate: relay - ...` in console (means TURN is working)

### Issue: "InvalidStateError: Called in wrong state"
- **Cause:** Duplicate/late answer received
- **Fix:** Already handled - should be ignored now

### Issue: "No video from remote participant"
- **Cause:** Tracks not being received
- **Check Console:**
  - Look for: `📹 Received remote track from ...`
  - Look for: `✅ ICE: Updated stream for ... with X live track(s)`
- **If missing:** Connection may not be fully established

## ✅ Step 5: Verify Server is Running

**Test Server Health:**
```bash
curl https://your-server.railway.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "WebRTC signaling server is running",
  "socketio": "ready",
  "cors": {
    "mode": "production",
    "allowedOrigins": "https://your-client.vercel.app"
  }
}
```

**If it fails:**
- Server may not be deployed
- Check Railway/Render logs for errors
- Verify `PORT` environment variable is set

## ✅ Step 6: Check Browser Console for Specific Errors

**Open Browser Console (F12) and look for:**

1. **Socket Connection:**
   ```
   🔌 Attempting to connect to: https://your-server.railway.app
   ✅ Socket connected: [id]
   ```

2. **WebRTC:**
   ```
   📤 Creating and sending offer to ...
   📥 Received answer from ...
   ✅ ICE connection established with ...
   ```

3. **Errors to Watch For:**
   - `❌ VITE_SOCKET_URL environment variable is not set!` → Set env var
   - `❌ Origin not allowed` → Fix CORS_ORIGIN
   - `❌ Socket connection error` → Check server URL and CORS
   - `❌ ICE connection failed` → NAT/firewall issue (TURN should help)

## 🔍 Debug Checklist

- [ ] `VITE_SOCKET_URL` is set in client deployment
- [ ] `CORS_ORIGIN` includes client URL in server deployment
- [ ] Server health endpoint returns `{"status":"ok"}`
- [ ] Browser console shows `✅ Socket connected`
- [ ] Browser console shows `✅ ICE connection established`
- [ ] No CORS errors in browser console
- [ ] No `InvalidStateError` errors (should be handled now)

## 📞 Still Not Working?

1. **Check Server Logs:**
   - Railway: Go to "Deployments" → Click latest → "View Logs"
   - Render: Go to "Logs" tab
   - Look for errors or CORS rejections

2. **Check Client Logs:**
   - Open browser console
   - Copy all errors and warnings
   - Share them for debugging

3. **Test Server Directly:**
   ```bash
   # Test health endpoint
   curl https://your-server.railway.app/health
   
   # Test Socket.io (should return HTML)
   curl https://your-server.railway.app/socket.io/
   ```

4. **Verify URLs:**
   - Client URL: `https://your-client.vercel.app`
   - Server URL: `https://your-server.railway.app`
   - Make sure they match in environment variables

## 🎯 Quick Fixes

### Fix 1: Missing VITE_SOCKET_URL
```bash
# In Vercel dashboard:
VITE_SOCKET_URL=https://your-server.railway.app
```

### Fix 2: Wrong CORS_ORIGIN
```bash
# In Railway dashboard:
CORS_ORIGIN=https://your-client.vercel.app
```

### Fix 3: Server Not Accessible
- Check Railway/Render deployment status
- Verify server is running (not crashed)
- Check server logs for startup errors

