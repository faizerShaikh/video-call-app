# 🔧 Deployment Troubleshooting Guide

## Common Build Failures

### Issue 1: "Build command failed" on Railway/Render

**Problem**: The platform is trying to run a build command that fails.

**Solution**:
1. **Railway**: 
   - Go to your service settings
   - Under "Build Command", leave it **empty** or set to: `npm install`
   - Railway will auto-detect Node.js and install dependencies

2. **Render**:
   - In your service settings
   - Set **Build Command** to: `npm install`
   - Set **Start Command** to: `npm start`

### Issue 2: "Cannot find module" errors

**Problem**: Dependencies not installed or wrong Node.js version.

**Solution**:
1. Make sure `package.json` is in the `server/` folder
2. Ensure `node_modules` is in `.gitignore` (it should be)
3. Railway/Render will install dependencies automatically
4. Check Node.js version - should be 18+:
   ```json
   "engines": {
     "node": ">=18.0.0"
   }
   ```

### Issue 3: "Port already in use" or port issues

**Problem**: Platform expects a specific port.

**Solution**:
- Railway and Render provide `PORT` environment variable automatically
- Your server should use: `process.env.PORT || 3001`
- Check your `server.js` - it should already handle this

### Issue 4: "Root directory not found"

**Problem**: Platform can't find the server folder.

**Solution**:
- **Railway**: 
  - In service settings, set **Root Directory** to: `server`
- **Render**:
  - In service settings, set **Root Directory** to: `server`

## Railway-Specific Fixes

### If build fails on Railway:

1. **Check Build Settings**:
   - Root Directory: `server`
   - Build Command: (leave empty or `npm install`)
   - Start Command: `npm start`

2. **Check Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://your-client.vercel.app
   ```

3. **Check Logs**:
   - Go to "Deployments" tab
   - Click on the failed deployment
   - Check the build logs for specific errors

### Railway Build Command Options:

**Option 1** (Recommended - Auto-detect):
- Build Command: (leave empty)
- Railway will auto-detect and run `npm install`

**Option 2** (Explicit):
- Build Command: `npm install`
- Start Command: `npm start`

## Render-Specific Fixes

### If build fails on Render:

1. **Service Settings**:
   - **Environment**: Node
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

2. **Environment Variables**:
   - Add all required env vars in the Render dashboard

3. **Check Build Logs**:
   - Go to "Events" tab
   - Look for error messages

## Quick Fix Checklist

- [ ] Root directory set to `server`
- [ ] Build command is `npm install` or empty
- [ ] Start command is `npm start`
- [ ] `package.json` exists in `server/` folder
- [ ] `src/server.js` exists
- [ ] Environment variables are set
- [ ] Node.js version is 18+ (check `engines` in package.json)

## Testing Locally Before Deploy

```bash
# Test server locally
cd server
npm install
npm start

# Should see: "🚀 Server running on http://0.0.0.0:3001"
```

## Common Error Messages & Solutions

### "npm ERR! code ELIFECYCLE"
- **Cause**: Script error
- **Fix**: Check `package.json` scripts, ensure `start` command is correct

### "Cannot find module 'express'"
- **Cause**: Dependencies not installed
- **Fix**: Make sure `npm install` runs during build

### "Port 3001 is already in use"
- **Cause**: Port conflict
- **Fix**: Use `process.env.PORT || 3001` in your code (already done)

### "Root directory 'server' not found"
- **Cause**: Wrong root directory path
- **Fix**: Check your repository structure, ensure `server/` folder exists

## Still Having Issues?

1. **Check the deployment logs** - they show the exact error
2. **Test locally first** - `cd server && npm install && npm start`
3. **Verify file structure** - ensure all files are committed to git
4. **Check Node.js version** - add to `package.json`:
   ```json
   "engines": {
     "node": ">=18.0.0",
     "npm": ">=9.0.0"
   }
   ```

