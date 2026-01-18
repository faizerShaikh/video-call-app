# Docker Deployment Guide for VM

This guide will help you deploy the WebRTC application to a VM using Docker and Docker Compose.

## Prerequisites

1. **VM with Docker installed**
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker Engine 20.10+
   - Docker Compose 2.0+

2. **Network Access**
   - Port 80 (HTTP) - for client
   - Port 3001 (WebSocket/HTTP) - for server
   - If using HTTPS, port 443

3. **Domain (Optional but Recommended)**
   - For production, use a domain with SSL certificate
   - Options: Let's Encrypt (free), Cloudflare, or commercial SSL

## Step 1: Install Docker on VM

### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Step 2: Clone/Upload Project to VM

### Option A: Clone from Git

```bash
# Clone your repository
git clone <your-repo-url>
cd webrtc
```

### Option B: Upload via SCP

```bash
# From your local machine
scp -r /path/to/webrtc user@your-vm-ip:/home/user/
```

### Option C: Use Git with SSH

```bash
# On VM
git clone <your-repo-url>
cd webrtc
```

## Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cd /path/to/webrtc
nano .env
```

### For VM with IP Address (No Domain)

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# CORS Configuration - Replace with your VM's IP address
CORS_ORIGIN=http://YOUR_VM_IP:80,http://YOUR_VM_IP:5173,http://localhost:80,http://localhost:5173

# Client Configuration - Replace with your VM's IP address
VITE_SOCKET_URL=http://YOUR_VM_IP:3001
```

**Example:**
```env
CORS_ORIGIN=http://192.168.1.100:80,http://192.168.1.100:5173,http://localhost:80,http://localhost:5173
VITE_SOCKET_URL=http://192.168.1.100:3001
```

### For VM with Domain (Recommended for Production)

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# CORS Configuration - Replace with your domain
CORS_ORIGIN=https://yourdomain.com,http://yourdomain.com,https://www.yourdomain.com

# Client Configuration - Replace with your domain
VITE_SOCKET_URL=https://yourdomain.com:3001
# OR if using reverse proxy (recommended):
VITE_SOCKET_URL=https://yourdomain.com
```

**Important Notes:**
- Replace `YOUR_VM_IP` with your actual VM IP address
- Replace `yourdomain.com` with your actual domain
- For HTTPS, you'll need to set up a reverse proxy (see Step 6)

## Step 4: Build and Start Containers

### Build Images

```bash
# Build both services
docker-compose build

# Or build individually
docker-compose build server
docker-compose build client
```

### Start Services

```bash
# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server
docker-compose logs -f client
```

### Check Status

```bash
# Check running containers
docker-compose ps

# Check health status
docker-compose ps --format json | jq '.[] | {name: .Name, status: .State, health: .Health}'
```

## Step 5: Verify Deployment

### Test Server

```bash
# From VM
curl http://localhost:3001/health

# From your local machine (replace with VM IP)
curl http://YOUR_VM_IP:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "WebRTC signaling server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "socketio": "ready"
}
```

### Test Client

Open in browser:
- `http://YOUR_VM_IP` (or `https://yourdomain.com` if using domain)

### Test WebRTC Connection

1. Open the app in two different browsers/devices
2. Join the same room
3. Verify video/audio works

## Step 6: Set Up Reverse Proxy (Optional but Recommended)

For production with HTTPS, use Nginx as a reverse proxy.

### Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Configure Nginx

Create `/etc/nginx/sites-available/webrtc`:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Client (React app)
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Server (Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Server API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/webrtc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Get SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

### Update Environment Variables for HTTPS

```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
VITE_SOCKET_URL=https://yourdomain.com
```

Then rebuild client:
```bash
docker-compose build client
docker-compose up -d client
```

## Step 7: Firewall Configuration

### Ubuntu UFW

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow server port (if not using reverse proxy)
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Cloud Provider Firewall

If using AWS, GCP, Azure, etc., configure security groups/firewall rules:
- Allow inbound: Port 80 (HTTP), 443 (HTTPS)
- Optionally: Port 3001 (if not using reverse proxy)

## Step 8: Useful Docker Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client

# Last 100 lines
docker-compose logs --tail=100

# Since specific time
docker-compose logs --since 10m
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart server
docker-compose restart client
```

### Stop Services

```bash
# Stop all
docker-compose stop

# Stop specific service
docker-compose stop server
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or force recreate
docker-compose up -d --force-recreate
```

### Clean Up

```bash
# Stop and remove containers
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v

# Remove unused images
docker image prune -a
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Step 9: Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs server
docker-compose logs client

# Check container status
docker-compose ps

# Try running interactively
docker-compose run --rm server sh
```

### Connection Issues

1. **Check CORS configuration**
   ```bash
   # Verify .env file
   cat .env
   
   # Check server logs
   docker-compose logs server | grep CORS
   ```

2. **Check network connectivity**
   ```bash
   # From VM
   curl http://localhost:3001/health
   
   # From client container
   docker-compose exec client wget -O- http://server:3001/health
   ```

3. **Check firewall**
   ```bash
   sudo ufw status
   sudo iptables -L -n
   ```

### WebRTC Not Working

1. **Check TURN/STUN servers** - Ensure they're accessible
2. **Check browser console** - Look for WebRTC errors
3. **Check server logs** - Look for connection errors
4. **Verify ports are open** - WebRTC needs UDP ports for media

### High Resource Usage

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

## Step 10: Production Checklist

- [ ] Docker and Docker Compose installed
- [ ] Environment variables configured
- [ ] Containers built and running
- [ ] Health checks passing
- [ ] Firewall configured
- [ ] Domain configured (if using)
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Reverse proxy configured (if using)
- [ ] Logs monitored
- [ ] Backup strategy in place
- [ ] Monitoring set up (optional)

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables: `cat .env`
3. Test connectivity: `curl http://localhost:3001/health`
4. Check firewall: `sudo ufw status`
