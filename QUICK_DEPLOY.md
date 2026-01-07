# 🚀 Quick Deploy Guide - Fix Build Issues

## ⚠️ Common Build Failure: "Root Directory Not Found"

If your build is failing, it's usually because the platform can't find the `server` folder.

## ✅ Fix for Railway

1. **Go to Railway Dashboard** → Your Service → Settings

2. **Set Root Directory**:
   - Scroll to "Root Directory"
   - Set to: `server`
   - **This is critical!**

3. **Build Settings**:
   - **Build Command**: Leave **EMPTY** (Railway auto-detects)
   - **Start Command**: `npm start`

4. **If build still fails**, try:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. **Redeploy**: Click "Redeploy" or push a new commit

## ✅ Fix for Render

1. **Go to Render Dashboard** → Your Service → Settings

2. **Set Root Directory**:
   - Find "Root Directory" field
   - Set to: `server`
   - **This is critical!**

3. **Build Settings**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Save and Redeploy**

## 📋 Checklist

Before deploying, verify:

- [ ] Your repository structure:
  ```
  your-repo/
  ├── server/
  │   ├── package.json
  │   ├── src/
  │   │   ├── server.js
  │   │   └── socket.js
  │   └── ...
  └── client/
      └── ...
  ```

- [ ] `server/package.json` exists and has:
  ```json
  {
    "scripts": {
      "start": "node src/server.js"
    }
  }
  ```

- [ ] Root Directory is set to `server` in platform settings

- [ ] Environment variables are set:
  - `NODE_ENV=production`
  - `PORT=3001` (or let platform set it)
  - `CORS_ORIGIN=your-client-url`

## 🔍 Debugging Steps

1. **Check Build Logs**:
   - Railway: Deployments → Click failed deployment → View logs
   - Render: Events tab → Check build logs

2. **Look for these errors**:
   - "Root directory 'server' not found" → Set root directory
   - "Cannot find module" → Dependencies not installing
   - "npm ERR!" → Check package.json syntax

3. **Test Locally First**:
   ```bash
   cd server
   npm install
   npm start
   ```
   If this works locally, the issue is platform configuration.

## 🎯 Quick Fix Commands

If you're using Railway CLI:

```bash
cd server
railway init
railway link
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway up
```

## 📝 Platform-Specific Notes

### Railway
- **Root Directory**: Must be set to `server`
- **Build Command**: Can be empty (auto-detects) or `npm install`
- **Start Command**: `npm start`

### Render
- **Root Directory**: Must be set to `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node

### Vercel (Client Only)
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

## 🆘 Still Failing?

1. **Share the build logs** - they show the exact error
2. **Verify file structure** - ensure `server/` folder exists in repo
3. **Check git** - make sure all files are committed:
   ```bash
   git status
   git add .
   git commit -m "Fix deployment"
   git push
   ```

