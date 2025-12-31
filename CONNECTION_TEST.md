# Connection Test Guide

## Quick Test Steps

### 1. Verify Server is Running
```bash
# Check if server is listening on port 3001
lsof -i :3001

# Or test the health endpoint
curl http://localhost:3001/health
curl http://192.168.1.15:3001/health
```

### 2. Check Server Logs
When you try to connect, you should see in the server terminal:
- `🌐 Development mode: allowing origin: http://192.168.1.15:5173`
- `📡 Socket.io request:` (for polling requests)
- `✅ User connected:` (if successful)

### 3. Check Browser Console
Open DevTools (F12) and look for:
- `🔌 Attempting to connect to: http://192.168.1.15:3001`
- `🌐 Current origin: http://192.168.1.15:5173`
- `✅ Socket connected:` (if successful)
- `❌ Socket connection error:` (if failed)

### 4. Check Network Tab
In DevTools → Network tab:
- Filter by "WS" or "polling"
- Look for requests to `http://192.168.1.15:3001/socket.io/`
- Check the status code:
  - **200** = Success (polling)
  - **101** = Success (websocket upgrade)
  - **4xx/5xx** = Error

## Common Issues

### Issue: "xhr poll error"
**Possible causes:**
1. Server not restarted after code changes
2. CORS still blocking requests
3. Firewall blocking port 3001
4. Server not accessible from client IP

**Solutions:**
1. **Restart the server:**
   ```bash
   # Stop the server (Ctrl+C)
   cd server
   npm run dev
   ```

2. **Check server logs** - You should see connection attempts logged

3. **Test server accessibility:**
   ```bash
   # From the client machine, test if server is reachable
   curl http://192.168.1.15:3001/health
   ```

4. **Check firewall:**
   ```bash
   # macOS - Check if port is blocked
   sudo lsof -i :3001
   ```

### Issue: CORS errors
**Solution:** The server is now configured to allow all origins in development mode. Make sure:
- Server is running with latest code
- `NODE_ENV` is not set to "production"
- Server was restarted after code changes

## Debug Checklist

- [ ] Server is running (`npm run dev` in server directory)
- [ ] Server logs show "Development mode: allowing origin"
- [ ] Browser console shows connection attempt
- [ ] Network tab shows requests to `/socket.io/`
- [ ] No firewall blocking port 3001
- [ ] Server accessible via `curl http://192.168.1.15:3001/health`

