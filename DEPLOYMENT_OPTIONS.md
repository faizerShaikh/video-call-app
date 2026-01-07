# Deployment Options for WebRTC Video Calling App

## 🎯 Recommended: VM or Platform with Persistent Connections

For a WebRTC video calling app with Socket.io, you need **persistent WebSocket connections**, which serverless platforms (like Vercel) don't support well.

## 📊 Comparison

### ❌ Not Ideal: Serverless Platforms
- **Vercel, Netlify, AWS Lambda**
- ❌ No persistent WebSocket support
- ❌ Execution time limits
- ❌ Cold starts can cause connection drops
- ✅ Works but with limitations (polling only, higher latency)

### ✅ Recommended: Platforms with Persistent Connections

#### 1. **Railway** (Easiest - Recommended)
- ✅ Full WebSocket support
- ✅ Easy deployment from GitHub
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Simple setup

**Deployment:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd server
railway init
railway up
```

#### 2. **Render**
- ✅ Full WebSocket support
- ✅ Free tier available
- ✅ Easy GitHub integration
- ✅ Automatic HTTPS

**Deployment:**
- Connect GitHub repo
- Select "Web Service"
- Set build command: `cd server && npm install`
- Set start command: `cd server && npm start`

#### 3. **Fly.io**
- ✅ Full WebSocket support
- ✅ Global edge deployment
- ✅ Good for low latency
- ✅ Free tier available

#### 4. **DigitalOcean App Platform**
- ✅ Full WebSocket support
- ✅ Simple deployment
- ✅ $5/month minimum

#### 5. **Traditional VM (VPS)**
- ✅ Full control
- ✅ Best performance
- ✅ No limitations
- ⚠️ Requires server management
- ⚠️ Need to set up HTTPS, firewall, etc.

**Popular VPS Providers:**
- DigitalOcean Droplets ($4-6/month)
- Linode ($5/month)
- Vultr ($2.50/month)
- AWS EC2 (pay as you go)
- Google Cloud Compute Engine

## 🚀 Recommended Setup: Railway (Easiest)

### Why Railway?
1. **Easiest deployment** - Just connect GitHub
2. **Full WebSocket support** - No limitations
3. **Free tier** - $5 credit/month
4. **Automatic HTTPS** - SSL certificates included
5. **Environment variables** - Easy configuration

### Railway Deployment Steps

1. **Create Railway account**: https://railway.app

2. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the service**:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`

4. **Set environment variables**:
   ```
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://your-client-domain.com
   ```

5. **Deploy** - Railway will automatically deploy

6. **Get your URL**: Railway provides a URL like `https://your-app.up.railway.app`

7. **Update client**:
   ```env
   VITE_SOCKET_URL=https://your-app.up.railway.app
   ```

## 🖥️ Alternative: Traditional VM Setup

If you prefer a VM for full control:

### 1. **Choose a VPS Provider**
- DigitalOcean: https://www.digitalocean.com
- Create a droplet (Ubuntu 22.04 recommended)
- Minimum: 1GB RAM, 1 vCPU ($4-6/month)

### 2. **Server Setup**

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (for reverse proxy and HTTPS)
apt install -y nginx

# Install Certbot (for SSL certificates)
apt install -y certbot python3-certbot-nginx
```

### 3. **Deploy Your App**

```bash
# Clone your repository
git clone https://github.com/your-username/webrtc.git
cd webrtc/server

# Install dependencies
npm install

# Create .env file
nano .env
# Add:
# PORT=3001
# NODE_ENV=production
# CORS_ORIGIN=https://your-client-domain.com

# Start with PM2
pm2 start src/server.js --name webrtc-server
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

### 4. **Configure Nginx (Reverse Proxy + HTTPS)**

```bash
# Create Nginx config
nano /etc/nginx/sites-available/webrtc-server
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-server-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io specific
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/webrtc-server /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d your-server-domain.com
```

### 5. **Configure Firewall**

```bash
# Allow HTTP, HTTPS, and SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 🔄 Migration from Vercel to Railway/VM

1. **Deploy server to Railway or VM**
2. **Update client environment variable**:
   ```env
   VITE_SOCKET_URL=https://your-new-server-url.com
   ```
3. **Redeploy client** (if needed)
4. **Test the connection**

## 📝 Environment Variables for Production

### Server (.env)
```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-client-domain.com,https://your-client.vercel.app
```

### Client (.env)
```env
VITE_SOCKET_URL=https://your-server-domain.com
```

## 🎯 My Recommendation

**For easiest deployment**: Use **Railway**
- Takes 5 minutes to set up
- Full WebSocket support
- Free tier available
- No server management needed

**For full control**: Use a **VM (DigitalOcean/Linode)**
- Best performance
- Full control
- Requires some server management knowledge
- More cost-effective for high traffic

**Current Vercel setup**: Works but limited
- Use polling only (no WebSockets)
- Higher latency
- Good for testing, not ideal for production

## 🚀 Quick Start: Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. New Project → Deploy from GitHub
4. Select your repo
5. Set root directory to `server`
6. Add environment variables
7. Deploy!

Your server will be live in minutes with full WebSocket support! 🎉

