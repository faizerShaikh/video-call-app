# Nginx Deployment Guide for synchro.ai21.ca

This guide covers deploying the WebRTC backend server with Nginx as a reverse proxy for HTTPS access at `synchro.ai21.ca/api`.

## Prerequisites

- Ubuntu/Debian server with root or sudo access
- Domain `synchro.ai21.ca` pointing to your server's IP address
- Backend server running on `localhost:3001`
- Nginx installed (`sudo apt-get install nginx`)
- Certbot installed for Let's Encrypt SSL certificates

## Step 1: Install Nginx

```bash
sudo apt-get update
sudo apt-get install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Step 2: Install Certbot (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx -y
```

## Step 3: Generate SSL Certificate

```bash
sudo certbot certonly --nginx -d synchro.ai21.ca
```

Follow the prompts:
- Enter your email address
- Agree to terms of service
- The certificate will be saved to `/etc/letsencrypt/live/synchro.ai21.ca/`

## Step 4: Copy Nginx Configuration

1. Copy the nginx configuration file to the server:

```bash
# On your local machine, copy nginx.conf to server
scp nginx/nginx.conf user@synchro.ai21.ca:/tmp/nginx-synchro.conf
```

2. On the server, move it to the Nginx sites directory:

```bash
sudo mv /tmp/nginx-synchro.conf /etc/nginx/sites-available/synchro.ai21.ca
```

## Step 5: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/synchro.ai21.ca /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t
```

## Step 6: Update Backend Server Configuration

Ensure your backend server is configured to:

1. **Listen on localhost:3001** (not 0.0.0.0 or external IP)
2. **Set CORS_ORIGIN** environment variable:

```bash
# In your .env file or environment variables
CORS_ORIGIN=https://synchro.ai21.ca
```

Or in docker-compose:

```yaml
environment:
  - CORS_ORIGIN=https://synchro.ai21.ca
```

## Step 7: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Remove direct access to port 3001 (optional - for security)
# sudo ufw deny 3001/tcp
```

## Step 8: Restart Nginx

```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

## Step 9: Verify Deployment

1. **Test REST API:**
```bash
curl https://synchro.ai21.ca/api/
```

2. **Test Socket.io connection:**
Open browser console and check WebSocket connection to `wss://synchro.ai21.ca/socket.io/`

3. **Check SSL certificate:**
```bash
openssl s_client -connect synchro.ai21.ca:443 -servername synchro.ai21.ca
```

## Step 10: Auto-renew SSL Certificate

Certbot should set up auto-renewal automatically. Verify:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## Configuration Details

### Endpoints

- **REST APIs:** `https://synchro.ai21.ca/api/*`
  - Example: `https://synchro.ai21.ca/api/auth/login`
  
- **Socket.io:** `https://synchro.ai21.ca/socket.io/`
  - Automatically upgrades to WebSocket (wss://)

### Rate Limiting

- **REST APIs:** 10 requests/second per IP
- **Socket.io:** 20 requests/second per IP

### Timeouts

- **WebSocket:** 7 days (for persistent connections)
- **REST APIs:** 60 seconds

## Troubleshooting

### Check Nginx logs:
```bash
sudo tail -f /var/log/nginx/synchro.ai21.ca.error.log
sudo tail -f /var/log/nginx/synchro.ai21.ca.access.log
```

### Check backend server logs:
```bash
# If using Docker
docker logs webrtc-server

# If running directly
# Check your Node.js server logs
```

### Test backend directly:
```bash
curl http://localhost:3001/health
```

### Reload Nginx after changes:
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload without downtime
```

## Security Notes

1. Backend server should only listen on `localhost:3001` (not exposed externally)
2. Firewall should block direct access to port 3001
3. SSL certificate auto-renewal is configured by Certbot
4. Security headers are included in the nginx config
5. Rate limiting is enabled to prevent abuse

## Frontend Configuration

Update your frontend environment variables:

```env
VITE_SOCKET_URL=https://synchro.ai21.ca
VITE_API_URL=https://synchro.ai21.ca
```

Or in docker-compose:

```yaml
environment:
  - VITE_SOCKET_URL=https://synchro.ai21.ca
  - VITE_API_URL=https://synchro.ai21.ca
```

## Maintenance

### Renew SSL Certificate Manually:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### View Nginx Status:
```bash
sudo systemctl status nginx
```

### Disable Site:
```bash
sudo rm /etc/nginx/sites-enabled/synchro.ai21.ca
sudo systemctl reload nginx
```
