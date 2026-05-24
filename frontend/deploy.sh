#!/bin/bash

# Deploy script for Delivery-Custom-App-INGSW2-FRONTEND

set -e

echo "🚀 Starting deployment..."
echo "📝 Pulling latest changes from GitHub..."

git pull origin main

echo "📦 Rebuilding and deploying with Docker Compose..."

docker compose down
docker compose up -d --build

echo "✅ Deployment complete!"
echo "🌐 Frontend is available at http://localhost:8080"
echo ""
echo "📊 Container status:"
docker compose ps
