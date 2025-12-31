# Deployment Guide

## Server Deployment (Vercel)

Your server is deployed at: `https://video-call-app-server-faizer.vercel.app/`

### Server Configuration

The server needs to be configured to allow CORS from your client's origin. Update the `CORS_ORIGIN` environment variable in Vercel:

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add/Update:
   - `CORS_ORIGIN`: Your client URL(s), comma-separated
     - Example: `https://your-client.vercel.app,http://localhost:5173`
   - `NODE_ENV`: `production` (for production mode)

### Vercel Configuration

Make sure your `vercel.json` (if you have one) allows Socket.io:

```json
{
  "rewrites": [
    {
      "source": "/socket.io/:path*",
      "destination": "/socket.io/:path*"
    }
  ]
}
```

## Client Configuration

### Local Development

1. Create `.env` file in `client/` directory:
   ```env
   VITE_SOCKET_URL=https://video-call-app-server-faizer.vercel.app
   ```

2. Start the client:
   ```bash
   cd client
   npm run dev
   ```

### Production Deployment

1. Set environment variable in your hosting platform:
   - **Vercel**: Add `VITE_SOCKET_URL` in project settings
   - **Netlify**: Add in Site settings → Environment variables
   - **Other**: Add as build-time environment variable

2. Build and deploy:
   ```bash
   cd client
   npm run build
   # Deploy the dist/ folder
   ```

## Testing the Connection

1. **Test server health:**
   ```bash
   curl https://video-call-app-server-faizer.vercel.app/health
   ```

2. **Check browser console:**
   - Should see: `🔌 Attempting to connect to: https://video-call-app-server-faizer.vercel.app`
   - Should see: `✅ Socket connected:` if successful

3. **Check server logs:**
   - Vercel function logs should show connection attempts

## Important Notes

1. **HTTPS Required**: WebRTC requires HTTPS in production (Vercel provides this automatically)

2. **CORS Configuration**: Make sure your server allows your client's origin

3. **Socket.io on Vercel**: 
   - Vercel Serverless Functions have execution time limits
   - Consider using Vercel's WebSocket support or a dedicated Socket.io service for production
   - For now, the serverless function should work for testing

4. **Environment Variables**:
   - Client: `VITE_SOCKET_URL` (build-time variable)
   - Server: `CORS_ORIGIN`, `NODE_ENV` (runtime variables)

## Troubleshooting

### Connection Issues

1. **Check CORS**: Verify server allows your client origin
2. **Check Environment Variables**: Make sure `VITE_SOCKET_URL` is set correctly
3. **Check Server Logs**: Look for connection errors in Vercel logs
4. **Test Health Endpoint**: Verify server is accessible

### WebRTC Issues

1. **HTTPS Required**: Both client and server must use HTTPS in production
2. **STUN/TURN Servers**: May need additional TURN servers for production
3. **Firewall**: Some networks block WebRTC, may need TURN servers

