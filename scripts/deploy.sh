#!/bin/bash

# MixRead Deployment Script
# Usage: ./deploy.sh <server_ip> <domain> <stripe_key> <stripe_secret>

set -e

SERVER_IP="${1:-localhost}"
DOMAIN="${2:-api.mixread.local}"
STRIPE_KEY="${3:-pk_test_xxxxx}"
STRIPE_SECRET="${4:-sk_test_xxxxx}"

echo "🚀 MixRead Deployment Script"
echo "=============================="
echo "Server IP: $SERVER_IP"
echo "Domain: $DOMAIN"
echo ""

# Step 1: Prepare deployment
echo "📦 Step 1: Preparing deployment..."
mkdir -p deploy
cp -r backend deploy/
cp -r frontend deploy/
cp docker-compose.yml deploy/
cp Dockerfile deploy/backend/

# Step 2: Create .env file
echo "🔑 Step 2: Creating environment configuration..."
cat > deploy/.env << EOF
ENVIRONMENT=production
LOG_LEVEL=info
STRIPE_PUBLIC_KEY=$STRIPE_KEY
STRIPE_SECRET_KEY=$STRIPE_SECRET
DOMAIN=$DOMAIN
API_URL=https://$DOMAIN
EOF

echo "✅ Created .env file"

# Step 3: Create deployment archive
echo "📦 Step 3: Creating deployment package..."
cd deploy
tar -czf ../mixread-deploy.tar.gz .
cd ..
echo "✅ Created mixread-deploy.tar.gz"

# Step 4: Instructions for deployment
echo ""
echo "📋 Deployment Instructions:"
echo "=============================="
echo ""
echo "1. Copy to server:"
echo "   scp mixread-deploy.tar.gz user@$SERVER_IP:/home/user/"
echo ""
echo "2. SSH into server:"
echo "   ssh user@$SERVER_IP"
echo ""
echo "3. Extract and deploy:"
echo "   tar -xzf mixread-deploy.tar.gz"
echo "   cd deploy"
echo "   docker-compose up -d"
echo ""
echo "4. Verify deployment:"
echo "   docker-compose logs -f backend"
echo "   curl https://$DOMAIN/health"
echo ""
echo "5. Update DNS:"
echo "   Point $DOMAIN to $SERVER_IP"
echo ""
echo "6. Install SSL certificate:"
echo "   sudo certbot certonly --standalone -d $DOMAIN"
echo ""
echo "7. Configure Nginx reverse proxy"
echo ""
echo "✨ Deployment package ready: mixread-deploy.tar.gz"
