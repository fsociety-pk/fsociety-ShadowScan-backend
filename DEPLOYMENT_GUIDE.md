# ShadowScan Deployment Guide (Vercel + AWS EC2 + PM2)

## 1. Core rule

Frontend on Vercel is HTTPS, so backend should also be HTTPS in production.  
Use: `https://api.yourdomain.com`

If frontend calls `http://...`, browser blocks it (mixed content).

## 2. Push code

```bash
git push origin main
```

## 3. EC2 setup (Ubuntu)

```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 4. Backend deploy on EC2

```bash
git clone https://github.com/fsociety-pk/fsociety-ShadowScan-backend.git
cd fsociety-ShadowScan-backend
npm install
cp .env.example .env
```

Set production values in `.env`:

1. `NODE_ENV=production`
2. `PORT=5003` (use a free port if other PM2 apps already use 5000/5001/5002)
3. `MONGODB_URI=...`
4. `JWT_SECRET=...` (generate with `openssl rand -base64 64`)
5. `FRONTEND_URL=https://YOUR_VERCEL_DOMAIN`
6. `FRONTEND_URLS=https://YOUR_VERCEL_DOMAIN,https://YOUR_CUSTOM_DOMAIN` (optional)
7. API keys
8. `ADMIN_PANEL_SECRET=...` (generate with `openssl rand -base64 64`)

Run with PM2:

```bash
npm run build
npm run pm2:start
pm2 save
pm2 startup
```

If this EC2 already has two backends on PM2, run this one with a unique app name and env:

```bash
pm2 start dist/index.js --name shadowscan-backend --env production
pm2 save
```

## 5. Nginx reverse proxy

`/etc/nginx/sites-available/shadowscan-api`

```nginx
server {
    server_name api.shadowsan.com;

    location / {
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/shadowscan-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. SSL certificate (required)

Point DNS `api.shadowsan.com` to EC2 IP, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.shadowsan.com
```

## 7. Frontend on Vercel

Set Vercel env:

`VITE_API_URL=https://api.shadowsan.com/api`

Deploy frontend from `main`.

## 8. Verify

1. `https://api.shadowsan.com/api/health`
2. Open frontend URL
3. Test login + API pages
4. Check logs if needed:

```bash
pm2 logs shadowscan-backend
```
