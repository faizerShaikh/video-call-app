# 🖥️ VM Deployment Guide (Without Domain)

This guide helps you deploy the WebRTC app on a VM without a domain name.

## Why It Works Locally But Not in Production

### Local Environment
- ✅ Same network (localhost) = direct connection
- ✅ No NAT/firewall issues
- ✅ Simple network path

### Production Environment
- ❌ Different networks = NAT traversal needed
- ❌ Firewalls block direct connections
- ❌ Requires reliable TURN servers for relay

## Solution Options

### Option 1: Use Free Dynamic DNS (Recommended)

Get a free domain name for your VM:

#### Using DuckDNS (Free, Easy)
1. **Sign up**: Go to https://www.duckdns.org/
2. **Create subdomain**: Choose something like `yourname.duckdns.org`
3. **Get token**: Copy your token
4. **Install DuckDNS client on VM**:
   ```bash
   # On Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install curl
   
   # Create update script
   sudo nano /usr/local/bin/duckdns
   ```
   
   Add this content:
   ```bash
   #!/bin/bash
   echo url="https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duckdns.log -K -
   ```
   
   Make it executable:
   ```bash
   sudo chmod +x /usr/local/bin/duckdns
   ```
   
   Add to crontab (runs every 5 minutes):
   ```bash
   crontab -e
   # Add this line:
   */5 * * * * /usr/local/bin/duckdns >/dev/null 2>&1
   ```

5. **Set up HTTPS with Caddy** (automatic SSL):
   ```bash
   # Install Caddy
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   
   # Configure Caddy
   sudo nano /etc/caddy/Caddyfile
   ```
   
   Add this (replace with your DuckDNS domain):
   ```
   yourname.duckdns.org {
       reverse_proxy localhost:3001
   }
   ```
   
   Start Caddy:
   ```bash
   sudo systemctl enable caddy
   sudo systemctl start caddy
   ```

6. **Update firewall**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 3001/tcp  # For direct access if needed
   ```

#### Alternative: No-IP (Free)
1. Sign up at https://www.noip.com/
2. Create hostname (e.g., `yourname.ddns.net`)
3. Install Dynamic Update Client (DUC) on VM
4. Use same Caddy setup as above

### Option 2: Use Cloudflare Tunnel (No Port Forwarding Needed)

Best if you can't open ports on your VM:

1. **Install Cloudflare Tunnel**:
   ```bash
   # Download cloudflared
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x cloudflared-linux-amd64
   sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
   ```

2. **Authenticate**:
   ```bash
   cloudflared tunnel login
   ```

3. **Create tunnel**:
   ```bash
   cloudflared tunnel create webrtc-server
   ```

4. **Configure tunnel**:
   ```bash
   mkdir ~/.cloudflared
   nano ~/.cloudflared/config.yml
   ```
   
   Add:
   ```yaml
   tunnel: webrtc-server
   credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_ID.json
   
   ingress:
     - hostname: yourname.trycloudflare.com  # Free subdomain
       service: http://localhost:3001
     - service: http_status:404
   ```

5. **Run tunnel**:
   ```bash
   cloudflared tunnel run webrtc-server
   ```

6. **Set up as service** (optional):
   ```bash
   sudo nano /etc/systemd/system/cloudflared.service
   ```
   
   Add:
   ```ini
   [Unit]
   Description=Cloudflare Tunnel
   After=network.target
   
   [Service]
   Type=simple
   User=YOUR_USER
   ExecStart=/usr/local/bin/cloudflared tunnel run webrtc-server
   Restart=on-failure
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   Enable:
   ```bash
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

### Option 3: Use IP Address with Self-Signed Certificate (Not Recommended)

⚠️ **Warning**: Browsers will show security warnings, and WebRTC may not work properly.

Only use for testing:

1. **Generate self-signed certificate**:
   ```bash
   sudo apt install openssl
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

2. **Update server to use HTTPS**:
   - Modify server to use HTTPS
   - Users will need to accept security warning

## Deploying the Application

### 1. Install Dependencies on VM

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### 2. Clone and Setup

```bash
# Clone your repository
git clone YOUR_REPO_URL
cd webrtc

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

**Server** (create `server/.env`):
```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-client-domain.vercel.app,https://yourname.duckdns.org
HOST=0.0.0.0
```

**Client** (create `client/.env`):
```env
VITE_SOCKET_URL=https://yourname.duckdns.org
```

### 4. Build Client

```bash
cd client
npm run build
```

### 5. Run Server with PM2

```bash
cd server
pm2 start src/server.js --name webrtc-server
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

### 6. Serve Client (Option A: Nginx)

```bash
# Install Nginx
sudo apt install -y nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/webrtc-client
```

Add:
```nginx
server {
    listen 80;
    server_name yourname.duckdns.org;
    
    root /path/to/webrtc/client/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/webrtc-client /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Serve Client (Option B: PM2 with serve)

```bash
sudo npm install -g serve
cd client
pm2 serve dist 3000 --name webrtc-client --spa
pm2 save
```

## Improving WebRTC Connection Reliability

### Use Better TURN Servers

The free TURN servers may not be reliable. Consider:

1. **Metered.ca TURN** (Free tier available):
   - Sign up at https://www.metered.ca/stun-turn
   - Get credentials
   - Update `client/src/utils/webrtc.js`

2. **Twilio TURN** (Paid, very reliable):
   - Sign up at https://www.twilio.com/stun-turn
   - Get credentials
   - Update configuration

3. **Self-hosted TURN** (coturn):
   ```bash
   sudo apt install coturn
   sudo nano /etc/turnserver.conf
   ```
   
   Configure and update WebRTC config.

### Update WebRTC Configuration

Edit `client/src/utils/webrtc.js` to use better TURN servers:

```javascript
export const RTC_CONFIG = {
  iceServers: [
    // STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Better TURN servers (replace with your credentials)
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password',
    },
    {
      urls: 'turn:your-turn-server.com:5349',
      username: 'your-username',
      credential: 'your-password',
      transport: 'tcp',
    },
  ],
  iceCandidatePoolSize: 10,
};
```

## Testing

1. **Test server**:
   ```bash
   curl https://yourname.duckdns.org/health
   ```

2. **Test client**:
   - Open browser console
   - Look for: `✅ Socket connected`
   - Check for WebRTC connection errors

3. **Check logs**:
   ```bash
   pm2 logs webrtc-server
   ```

## Troubleshooting

### Connection Still Failing?

1. **Check firewall**:
   ```bash
   sudo ufw status
   sudo ufw allow 3001/tcp
   ```

2. **Check server logs**:
   ```bash
   pm2 logs webrtc-server
   ```

3. **Test TURN servers**:
   - Use https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
   - Add your TURN servers
   - Check if they're working

4. **Check browser console**:
   - Look for ICE candidate types
   - Should see `relay` candidates if TURN is working
   - If only `host` candidates, TURN isn't being used

### Common Issues

- **"Connection failed"**: TURN servers not working or firewall blocking
- **"Socket connection error"**: CORS issue or server not accessible
- **"getUserMedia error"**: HTTPS not configured properly

## Next Steps

1. Set up DuckDNS or Cloudflare Tunnel
2. Deploy server and client
3. Update TURN server configuration
4. Test connection
5. Monitor logs for issues

