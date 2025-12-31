# Troubleshooting WebSocket Connection Issues

## Current Issue: "Connection error: websocket error"

### Changes Made:

1. **Client now tries polling first, then upgrades to WebSocket**
   - More reliable across different network configurations
   - Polling works even if WebSocket is blocked

2. **Enhanced error logging**
   - Server now logs connection attempts and errors
   - Client shows more detailed error messages

3. **More permissive CORS in development**
   - Development mode allows connections even if origin doesn't match exactly

### Steps to Debug:

1. **Check Server Logs:**
   ```bash
   cd server
   npm run dev
   ```
   Look for:
   - `🌐 Checking origin: http://192.168.1.15:5173`
   - `✅ Origin allowed:` or `❌ Origin not allowed:`
   - `❌ Socket.io connection error:` (if any)

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for connection logs:
     - `🔌 Attempting to connect to: http://192.168.1.15:3001`
     - `✅ Socket connected:` (success)
     - `❌ Socket connection error:` (failure)

3. **Test Server Accessibility:**
   ```bash
   curl http://192.168.1.15:3001/health
   ```
   Should return: `{"status":"ok",...}`

4. **Check Network Tab:**
   - Open DevTools → Network tab
   - Filter by "WS" (WebSocket) or "polling"
   - Look for connection attempts to `http://192.168.1.15:3001/socket.io/`
   - Check the status code (should be 101 for WebSocket upgrade, 200 for polling)

### Common Issues:

1. **Firewall blocking WebSocket upgrades**
   - Solution: Use polling (already configured as fallback)

2. **CORS blocking the connection**
   - Solution: Development mode now allows all origins

3. **Server not running**
   - Solution: Make sure server is started before client

4. **Wrong IP address**
   - Solution: Verify your IP is `192.168.1.15`

### Next Steps:

1. **Restart both server and client:**
   ```bash
   # Terminal 1
   cd server
   npm run dev
   
   # Terminal 2
   cd client
   npm run dev
   ```

2. **Clear browser cache and reload**

3. **Check the Debug Info section** in the UI for connection details

4. **If still failing, check:**
   - Server terminal for connection logs
   - Browser console for detailed errors
   - Network tab for failed requests

