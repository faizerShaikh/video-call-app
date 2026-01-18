# Docker Setup Summary

## 📦 Files Created

### Docker Configuration Files
- ✅ `server/Dockerfile` - Server container configuration
- ✅ `client/Dockerfile` - Client container configuration (multi-stage build)
- ✅ `client/nginx.conf` - Nginx configuration for serving React app
- ✅ `docker-compose.yml` - Development/staging compose file
- ✅ `docker-compose.prod.yml` - Production compose file with resource limits
- ✅ `.dockerignore` - Root ignore file
- ✅ `server/.dockerignore` - Server ignore file
- ✅ `client/.dockerignore` - Client ignore file

### Documentation
- ✅ `DOCKER_DEPLOYMENT.md` - Complete deployment guide
- ✅ `QUICK_START_DOCKER.md` - Quick start guide (5 minutes)
- ✅ `Makefile` - Convenient make commands

### Environment
- ✅ `.env.example` - Example environment variables (you need to create `.env`)

## 🚀 Quick Start

### 1. Create `.env` file
```bash
cp .env.example .env
nano .env  # Edit with your VM IP or domain
```

### 2. Build and start
```bash
docker-compose build
docker-compose up -d
```

### 3. Check status
```bash
docker-compose ps
docker-compose logs -f
```

## 📋 Deployment Steps

### Step 1: Install Docker on VM
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Upload Project
```bash
# Option A: Git clone
git clone <your-repo-url>
cd webrtc

# Option B: SCP from local machine
scp -r /path/to/webrtc user@vm-ip:/home/user/
```

### Step 3: Configure Environment
```bash
# Create .env file
nano .env

# For VM with IP:
CORS_ORIGIN=http://YOUR_VM_IP:80,http://YOUR_VM_IP:5173
VITE_SOCKET_URL=http://YOUR_VM_IP:3001

# For VM with domain:
CORS_ORIGIN=https://yourdomain.com,http://yourdomain.com
VITE_SOCKET_URL=https://yourdomain.com:3001
```

### Step 4: Build and Deploy
```bash
docker-compose build
docker-compose up -d
```

### Step 5: Configure Firewall
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw enable
```

### Step 6: Test
- Open: `http://YOUR_VM_IP` or `https://yourdomain.com`
- Test in two browsers
- Join same room and verify video

## 🛠️ Useful Commands

### Using Makefile
```bash
make build          # Build images
make up             # Start containers
make down           # Stop containers
make logs           # View logs
make restart        # Restart containers
make test           # Test server health
make update         # Update and rebuild
```

### Using Docker Compose
```bash
docker-compose build              # Build images
docker-compose up -d              # Start in background
docker-compose down               # Stop and remove
docker-compose restart            # Restart
docker-compose logs -f            # View logs
docker-compose ps                 # Show status
docker-compose exec server sh     # Shell into server
docker-compose exec client sh     # Shell into client
```

## 🔧 Architecture

```
┌─────────────────┐
│   Client (80)   │  ← React app served by Nginx
│   Container     │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  Server (3001)  │  ← Node.js + Socket.io
│   Container     │
└─────────────────┘
```

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://192.168.1.100:80,https://example.com` |
| `VITE_SOCKET_URL` | Socket.io server URL | `http://192.168.1.100:3001` |

## 🔒 Production Recommendations

1. **Use HTTPS** - Set up reverse proxy with SSL (Let's Encrypt)
2. **Use Domain** - Instead of IP address
3. **Resource Limits** - Use `docker-compose.prod.yml`
4. **Monitoring** - Set up log aggregation
5. **Backups** - Regular backups of `.env` and data
6. **Updates** - Regular security updates

## 📚 Documentation

- **Quick Start**: `QUICK_START_DOCKER.md` (5 minutes)
- **Full Guide**: `DOCKER_DEPLOYMENT.md` (comprehensive)
- **Troubleshooting**: See `DOCKER_DEPLOYMENT.md` Step 9

## ✅ Checklist

Before deploying:
- [ ] Docker and Docker Compose installed
- [ ] `.env` file created and configured
- [ ] Firewall ports opened (80, 443, 3001)
- [ ] Domain configured (if using)
- [ ] SSL certificate obtained (if using HTTPS)

After deploying:
- [ ] Containers running: `docker-compose ps`
- [ ] Server health check: `curl http://localhost:3001/health`
- [ ] Client accessible: Open in browser
- [ ] WebRTC working: Test with 2+ participants

## 🆘 Troubleshooting

**Issue**: Containers won't start
- Check logs: `docker-compose logs -f`
- Verify `.env` file exists
- Check port availability: `netstat -tuln | grep -E '80|3001'`

**Issue**: Can't connect from browser
- Check firewall: `sudo ufw status`
- Verify CORS in `.env` matches your IP/domain
- Check server logs: `docker-compose logs server`

**Issue**: WebRTC not working
- Check browser console for errors
- Verify TURN/STUN servers accessible
- Check server logs for connection errors

For more help, see `DOCKER_DEPLOYMENT.md` Step 9.
