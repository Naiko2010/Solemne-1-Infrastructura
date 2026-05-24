# Deployment Guide — Delivery Custom App

Complete guide for deploying to development, staging, and production environments.

---

## 🐳 Docker Development

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Docker Desktop running

### Development with Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View backend logs only
docker-compose -f docker-compose.dev.yml logs -f backend

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes
docker-compose -f docker-compose.dev.yml down -v

# Rebuild images
docker-compose -f docker-compose.dev.yml up -d --build
```

### Services in Development

**Backend** (FastAPI + Uvicorn)
- Port: `8000`
- API Docs: `http://localhost:8000/api/docs`
- Hot reload enabled
- Volume: `./src:/app/src` (code changes auto-reload)

**Frontend** (Vite)
- Port: `5173`
- Hot reload enabled
- Volume: `../Delivery-Custom-App-INGSW2-FRONTEND:/app`

### Docker Compose Files

**docker-compose.dev.yml** - Local development
- Uses `.env` for configuration
- Volumes mounted for hot reload
- Network bridge for inter-service communication

**docker-compose.yml** - Production reference
- Build without volumes
- Environment from `.env` only
- Health checks configured

---

## 🏗️ Docker Images

### Building Backend Image

```bash
# Build for development
docker build -f Dockerfile -t delivery-backend:dev .

# Build for production
docker build -f Dockerfile -t delivery-backend:1.0.0 .

# List images
docker images | grep delivery
```

### Backend Dockerfile

Multi-stage build:
1. **Builder stage** - Compiles Python packages
2. **Runtime stage** - Minimal image with only runtime

Benefits:
- Smaller final image (~500MB vs 1.5GB)
- Faster startup
- Better security (no build tools)

### Building Frontend Image

```bash
# Build image
docker build -f Dockerfile.dev \
  -t delivery-frontend:dev \
  ../Delivery-Custom-App-INGSW2-FRONTEND

# Run container
docker run -p 5173:5173 delivery-frontend:dev
```

---

## 🚀 Production Deployment

### Backend Deployment (Render, Railway, or similar)

1. **Connect Repository**
   ```bash
   git clone https://github.com/SibaGestion/Delivery-Custom-App-INGSW2.git
   ```

2. **Set Environment Variables**
   ```env
   APP_ENV=production
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_service_key
   JWT_SECRET=your_jwt_secret_production
   DATABASE_URL=postgresql://user:pass@host/dbname
   ```

3. **Deploy Command**
   ```bash
   python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
   ```

4. **Health Check**
   ```
   GET /health
   Expected: 200 {"status": "ok"}
   ```

### Frontend Deployment (Vercel, Netlify, or similar)

1. **Connect Repository**
   - Point to `Delivery-Custom-App-INGSW2-FRONTEND` folder

2. **Build Command**
   ```bash
   npm install && npm run build
   ```

3. **Output Directory**
   ```
   dist/
   ```

4. **Environment Variables**
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_KEY=your_anon_key
   VITE_API_BASE_URL=https://api.example.com
   ```

5. **Deploy**
   - Platform auto-deploys on push to main branch

---

## 📊 Environment Configuration

### Development (`.env`)

```env
APP_ENV=development
APP_DEBUG=true
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_KEY=test_anon_key
JWT_SECRET=test_secret_change_in_production
```

### Staging (`.env.staging`)

```env
APP_ENV=staging
APP_DEBUG=false
CORS_ORIGINS=https://staging-app.example.com
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_KEY=staging_anon_key
JWT_SECRET=staging_jwt_secret_must_be_different
DATABASE_URL=postgresql://user:pass@staging-db/db
```

### Production (`.env.prod`)

```env
APP_ENV=production
APP_DEBUG=false
CORS_ORIGINS=https://app.example.com
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_KEY=prod_anon_key
JWT_SECRET=prod_jwt_secret_very_secure
DATABASE_URL=postgresql://user:pass@prod-db/db
PYTHONUNBUFFERED=1
```

---

## 🔄 Manual Docker Deployment

### Build and Run Backend

```bash
# 1. Build image
docker build -f Dockerfile -t delivery-backend:1.0.0 .

# 2. Run container
docker run -d \
  --name delivery-backend \
  -p 8000:8000 \
  --env-file .env.prod \
  -v logs:/app/logs \
  delivery-backend:1.0.0

# 3. Verify running
docker ps | grep delivery-backend

# 4. Check logs
docker logs -f delivery-backend

# 5. Stop container
docker stop delivery-backend

# 6. Remove container
docker rm delivery-backend
```

### Docker Networking

```bash
# Create network
docker network create delivery-network

# Run backend on network
docker run -d \
  --network delivery-network \
  --name backend \
  -p 8000:8000 \
  delivery-backend:1.0.0

# Run frontend on same network
docker run -d \
  --network delivery-network \
  --name frontend \
  -p 80:5173 \
  delivery-frontend:1.0.0

# Frontend can now reach backend at http://backend:8000
```

---

## 📈 Scaling & Performance

### Backend Scaling

1. **Horizontal Scaling** - Multiple containers behind load balancer
   ```bash
   # Start 3 backend instances
   docker-compose -f docker-compose.prod.yml up -d --scale backend=3
   ```

2. **Database Connection Pooling**
   - Configure in Supabase dashboard
   - Recommended: 1 connection per 100 requests

3. **Caching Layer**
   - Implement Redis for session/data caching
   - Frontend caching: 30 seconds (configurable)

### Frontend Optimization

1. **CDN** - Distribute assets globally
   - Recommended: Cloudflare, AWS CloudFront
   - Cache static assets (images, CSS, JS)

2. **Compression**
   - Gzip enabled by default in Vite build
   - Brotli for further compression (recommended)

3. **Code Splitting**
   - Vite automatically splits code by route
   - Lazy loading for large components

---

## 🔒 Security Checklist

### Before Production

- [ ] Remove debug logging
- [ ] Set `APP_DEBUG=false`
- [ ] Update `JWT_SECRET` with production value
- [ ] Configure `CORS_ORIGINS` to production domain only
- [ ] Enable HTTPS (443)
- [ ] Set strong database password
- [ ] Rotate API keys
- [ ] Enable RLS policies in Supabase
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts
- [ ] Test automated backups
- [ ] Document incident response plan

---

## 🆘 Troubleshooting

### Backend Won't Start

```bash
# Check container logs
docker logs delivery-backend

# Common issues:
# 1. Port already in use
docker ps | grep 8000
lsof -i :8000

# 2. Environment variables not set
docker inspect delivery-backend | grep Env

# 3. Database connection failed
# Verify SUPABASE_URL and credentials in .env
```

### Frontend Connection Issues

```bash
# Check API URL
# DevTools → Network → filter: /api
# Verify VITE_API_BASE_URL matches backend URL

# CORS error? Check:
# Backend CORS_ORIGINS includes frontend domain
# Frontend makes requests with correct headers
```

### Memory Issues

```bash
# Check memory usage
docker stats

# Limit container memory
docker run -d \
  --memory="512m" \
  --memory-swap="1g" \
  delivery-backend:1.0.0
```

---

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Render Deployment](https://render.com/docs)
- [Vercel Deployment](https://vercel.com/docs)
- [Netlify Deployment](https://docs.netlify.com/)
