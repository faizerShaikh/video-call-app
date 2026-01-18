# Quick Start - Docker Deployment

## Prerequisites
- Docker and Docker Compose installed
- VM with ports 80 and 3001 accessible

## Quick Setup (5 minutes)

### 1. Clone/Upload Project
```bash
git clone <your-repo-url>
cd webrtc
```

### 2. Create `.env` File
```bash
cat > .env << EOF
NODE_ENV=production
PORT=3001
CORS_ORIGIN=http://YOUR_VM_IP:80,http://YOUR_VM_IP:5173
VITE_SOCKET_URL=http://YOUR_VM_IP:3001
EOF
```

**Replace `YOUR_VM_IP` with your actual VM IP address**

### 3. Build and Start
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Test
- Open browser: `http://YOUR_VM_IP`
- Test in two browsers/devices
- Join same room and verify video works

## Common Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose stop

# Update
git pull
docker-compose build
docker-compose up -d
```

## Troubleshooting

**Can't connect?**
- Check firewall: `sudo ufw allow 80,3001/tcp`
- Check logs: `docker-compose logs -f`
- Test server: `curl http://localhost:3001/health`

**WebRTC not working?**
- Check browser console for errors
- Verify CORS in `.env` matches your IP
- Check server logs for connection errors

For detailed guide, see [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
