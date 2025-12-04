# MixRead Deployment Guide

This guide covers deploying MixRead to production for weekend launch.

## 📋 Pre-Deployment Checklist

- [ ] Code tested locally
- [ ] Backend API running and verified
- [ ] Chrome extension tested
- [ ] Domain configured
- [ ] SSL certificate ready (if using HTTPS)
- [ ] Payment system configured
- [ ] DNS records updated

---

## 🚀 Backend Deployment Options

### Option 1: Docker on Cloud Server (Recommended)

**Best for:** Fast, scalable, reliable

#### 1. Install Docker & Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Deploy Using Docker Compose

```bash
# SSH into your server
ssh user@your-server.com

# Clone the repository
git clone <your-repo> mixread
cd mixread

# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Verify it's running
curl http://localhost:8000/health
# Expected response: {"status": "ok", "words_loaded": 6860}
```

#### 3. Optional: Use Nginx Reverse Proxy

For production with SSL:

```bash
# Install Nginx
sudo apt-get install nginx

# Enable SSL with Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com

# Update nginx config to proxy to backend
# Edit /etc/nginx/sites-available/default with reverse proxy config
```

---

### Option 2: Railway.app (No Docker Knowledge Required)

**Best for:** Simplicity, free tier available

1. Create account at https://railway.app
2. Connect GitHub repo
3. Set environment variables
4. Deploy - that's it!

Railway will automatically build and run the Docker container.

---

### Option 3: Heroku

**Best for:** Quick setup, integrated with GitHub

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create mixread-api

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

---

## 🌐 Domain & DNS Configuration

### 1. Domain Setup

```
your-domain.com
│
├── backend API: api.your-domain.com → points to server IP
├── Landing page: your-domain.com → optional
└── CDN (optional): cdn.your-domain.com → for static files
```

### 2. Update Extension Config

In `frontend/manifest.json`, update the API endpoint:

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://*/*", "http://*/*"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

In `frontend/background.js`, update the API URL:

```javascript
// Change from http://localhost:8000 to your production URL
const API_BASE_URL = "https://api.your-domain.com";
```

---

## 💳 Payment System Setup

### Option 1: Stripe Checkout (Recommended)

```javascript
// Create a simple landing page with Stripe button
// In your Chrome extension or website

<script src="https://checkout.stripe.com/checkout.js"></script>

<button id="stripe-button">
  Donate / Support MixRead
</button>

<script>
const handler = StripeCheckout.configure({
  key: 'pk_live_YOUR_STRIPE_KEY',
  locale: 'auto',
  token: function(token) {
    // Handle the token (send to backend for processing)
  }
});

document.getElementById('stripe-button').addEventListener('click', function(e) {
  handler.openURL({
    name: 'MixRead Premium',
    description: 'Support MixRead Development',
    amount: 999, // $9.99
    currency: 'usd'
  });
  e.preventDefault();
});
</script>
```

### Option 2: PayPal Integration

```html
<!-- Add to your landing page -->
<div id="smart-button-container">
  <div style="text-align: center;"><iframe id="myIframe" style="border: none; width: 100%; height: 500px;" src="https://www.paypal.com/checkoutnow?token=..."></iframe></div>
</div>
```

### Option 3: Gumroad (Simplest)

Just create a product at gumroad.com and share the link.

---

## 🔒 Environment Variables

Create `.env` file on server:

```bash
# .env (NEVER commit this to git!)
ENVIRONMENT=production
LOG_LEVEL=info
CORS_ORIGINS="https://your-domain.com,https://chrome-extension-id"
DATABASE_URL=postgresql://user:pass@localhost/mixread
STRIPE_SECRET_KEY=sk_live_xxxxx
```

---

## 📊 Monitoring & Logging

### 1. Basic Health Check

```bash
# Test API is responding
curl https://api.your-domain.com/health

# Test word lookup
curl https://api.your-domain.com/word/beautiful
```

### 2. Log Monitoring

```bash
# View logs with Docker
docker-compose logs -f backend

# Or with tail
tail -f /var/log/nginx/access.log
```

### 3. Performance Monitoring

```bash
# Load testing with ab (Apache Bench)
ab -n 100 -c 10 https://api.your-domain.com/health

# Or with wrk (better tool)
wrk -t4 -c100 -d30s https://api.your-domain.com/health
```

---

## 📱 Chrome Extension Publishing

### Step 1: Prepare for Chrome Web Store

1. Update manifest.json with production permissions
2. Update icon.png (128x128 required)
3. Create extension description (< 132 characters)
4. Create privacy policy

### Step 2: Submit to Chrome Web Store

1. Go to https://chrome.google.com/webstore/developer/dashboard
2. Create new item
3. Upload frontend folder as ZIP
4. Fill in details and screenshots
5. Submit for review (usually 1-3 days)

### Step 3: Hosting on GitHub Pages (Optional)

Create a landing page:

```bash
mkdir docs
cat > docs/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>MixRead</title></head>
<body>
<h1>🎉 MixRead Launched!</h1>
<p>Install from <a href="https://chrome.google.com/webstore/detail/...">Chrome Web Store</a></p>
</body>
</html>
EOF

# Enable GitHub Pages: Settings → Pages → Source: docs folder
```

---

## 🎯 Launch Checklist

- [ ] Backend deployed and responding
- [ ] Domain pointing to correct IP
- [ ] SSL certificate installed
- [ ] Extension API endpoint updated to production URL
- [ ] Extension tested on production backend
- [ ] Payment system connected (Stripe/PayPal/Gumroad)
- [ ] Landing page ready
- [ ] Chrome Web Store submission complete
- [ ] Social media announcements ready
- [ ] Email list setup (if applicable)

---

## 🆘 Troubleshooting

### Backend not responding

```bash
# Check if container is running
docker-compose ps

# View detailed logs
docker-compose logs backend

# Restart
docker-compose restart backend
```

### CORS errors in extension

Update `main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-domain.com",
        "chrome-extension://YOUR_EXTENSION_ID"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### High latency / slow responses

```bash
# Check CPU and memory
docker stats

# Scale workers in docker-compose.yml or Procfile
# Increase: WORKERS=8
```

---

## 📈 Post-Launch

1. **Monitor**: Set up uptime monitoring (UptimeRobot, Pingdom)
2. **Errors**: Configure error tracking (Sentry, LogRocket)
3. **Analytics**: Add user analytics (Mixpanel, Amplitude)
4. **Feedback**: Create feedback collection mechanism
5. **Updates**: Plan weekly updates and improvements

---

## 🔗 Useful Resources

- [Docker Deployment Guide](https://docs.docker.com/)
- [Stripe Integration](https://stripe.com/docs)
- [Chrome Extension Publishing](https://developer.chrome.com/docs/extensions/mv3/publish/)
- [Railway Deployment](https://railway.app/docs)
- [Let's Encrypt SSL](https://letsencrypt.org/getting-started/)
