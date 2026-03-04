# Frontend Deployment Guide for synchro.ai21.ca

This guide covers deploying the React frontend with Nginx on `synchro.ai21.ca`.

## Prerequisites

- Backend server running and accessible via nginx (already configured)
- Node.js and npm installed on build machine (for building the app)
- Nginx installed and configured on the server
- SSL certificate installed (should be done with backend setup)

## Step 1: Build the Frontend

On your local machine or CI/CD:

```bash
cd client

# Install dependencies (if not already done)
npm install

# Build for production
npm run build
```

The build output will be in `client/dist/` directory.

## Step 2: Prepare Environment Variables

Before building, ensure you set the correct environment variables:

```bash
# In client/.env or client/.env.production
VITE_SOCKET_URL=https://synchro.ai21.ca
VITE_API_URL=https://synchro.ai21.ca
```

Or build with environment variables:

```bash
VITE_SOCKET_URL=https://synchro.ai21.ca VITE_API_URL=https://synchro.ai21.ca npm run build
```

## Step 3: Transfer Build Files to Server

Copy the `dist` folder contents to your server:

```bash
# From your local machine
cd client
scp -r dist/* user@synchro.ai21.ca:/tmp/synchro-frontend/

# Or use rsync for better transfer
rsync -avz --delete dist/ user@synchro.ai21.ca:/tmp/synchro-frontend/
```

## Step 4: Create Web Directory and Copy Files

On the server:

```bash
# Create web directory
sudo mkdir -p /var/www/synchro.ai21.ca

# Copy files from /tmp
sudo cp -r /tmp/synchro-frontend/* /var/www/synchro.ai21.ca/

# Set proper permissions
sudo chown -R www-data:www-data /var/www/synchro.ai21.ca
sudo chmod -R 755 /var/www/synchro.ai21.ca
```

## Step 5: Update Nginx Configuration

The nginx configuration should already include the frontend serving block. Verify that `/etc/nginx/sites-available/synchro.ai21.ca` contains:

```nginx
root /var/www/synchro.ai21.ca;
index index.html;

location / {
    try_files $uri $uri/ /index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

If not, copy the updated `nginx.conf` from the repository.

## Step 6: Test and Reload Nginx

```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 7: Verify Deployment

1. **Test Frontend:**

   ```bash
   curl https://synchro.ai21.ca/
   ```

2. **Check in Browser:**
   - Open `https://synchro.ai21.ca/` in browser
   - Should show login page
   - Check browser console for any errors

3. **Verify API Connection:**
   - Check Network tab in browser DevTools
   - API calls should go to `https://synchro.ai21.ca/api/`
   - Socket.io should connect to `https://synchro.ai21.ca/socket.io/`

## Directory Structure

After deployment, your server should have:

```
/var/www/synchro.ai21.ca/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── favicon.png
├── logo.png
└── ...
```

## Updating the Frontend

When you need to update the frontend:

1. **Build new version:**

   ```bash
   cd client
   npm run build
   ```

2. **Transfer to server:**

   ```bash
   rsync -avz --delete dist/ user@synchro.ai21.ca:/tmp/synchro-frontend/
   ```

3. **On server, update files:**

   ```bash
   sudo cp -r /tmp/synchro-frontend/* /var/www/synchro.ai21.ca/
   sudo chown -R www-data:www-data /var/www/synchro.ai21.ca
   ```

4. **Clear browser cache or do hard refresh:**
   - Users may need to clear cache (Ctrl+Shift+R / Cmd+Shift+R)
   - Or use cache-busting version numbers in build

## Troubleshooting

### Frontend shows blank page

1. **Check file permissions:**

   ```bash
   ls -la /var/www/synchro.ai21.ca/
   ```

2. **Check nginx error logs:**

   ```bash
   sudo tail -f /var/log/nginx/synchro.ai21.ca.error.log
   ```

3. **Verify index.html exists:**
   ```bash
   cat /var/www/synchro.ai21.ca/index.html
   ```

### React Router routes return 404

- Ensure `try_files $uri $uri/ /index.html;` is in the `location /` block
- This makes nginx serve `index.html` for all routes, allowing React Router to handle routing

### API calls failing

1. **Check browser console for CORS errors**
2. **Verify backend CORS_ORIGIN includes `https://synchro.ai21.ca`**
3. **Check nginx is proxying `/api/` correctly**

### Assets not loading

1. **Check file paths in `index.html`:**

   ```bash
   grep -o 'src="[^"]*"' /var/www/synchro.ai21.ca/index.html
   ```

2. **Verify assets directory exists:**

   ```bash
   ls -la /var/www/synchro.ai21.ca/assets/
   ```

3. **Check nginx is serving static files correctly**

## Environment Variables

When building for production, ensure these are set:

- `VITE_SOCKET_URL=https://synchro.ai21.ca` (Socket.io endpoint)
- `VITE_API_URL=https://synchro.ai21.ca` (REST API endpoint - optional if using same domain)

These are baked into the build at build time, so they must be set before running `npm run build`.

## Complete Nginx Configuration

The complete nginx configuration should handle:

1. **Frontend (SPA):** Root `/` → serves static files from `/var/www/synchro.ai21.ca`
2. **Socket.io:** `/socket.io/` → proxies to `localhost:3001`
3. **REST APIs:** `/api/` → proxies to `localhost:3001/api/`
4. **Health:** `/health` → proxies to `localhost:3001/health`

All with HTTPS and proper security headers.
