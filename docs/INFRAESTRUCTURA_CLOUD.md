# Infraestructura Cloud — Identificación de Modelos IaaS, PaaS y SaaS

Este documento identifica, justifica y clasifica todos los servicios de infraestructura cloud utilizados en **Delivery Custom App**, según los modelos **IaaS (Infrastructure as a Service)**, **PaaS (Platform as a Service)** y **SaaS (Software as a Service)**.

---

## Resumen de Clasificación

| Servicio | Modelo | Rol en el sistema |
|----------|--------|-------------------|
| Docker + docker-compose | **IaaS** | Contenerización del backend y frontend |
| GitHub Actions (CI/CD) | **IaaS** | Pipeline de integración y despliegue continuo |
| Render / Railway (backend) | **PaaS** | Despliegue del backend FastAPI sin gestionar servidores |
| Vercel / Netlify (frontend) | **PaaS** | Despliegue del frontend estático (React + Vite) |
| Supabase Auth | **SaaS** | Autenticación de usuarios con JWT |
| Supabase Database (PostgreSQL) | **SaaS** | Base de datos relacional administrada en la nube |

---

## 1. IaaS — Infrastructure as a Service

> El proveedor entrega recursos de cómputo, red y almacenamiento. El equipo de desarrollo gestiona el sistema operativo, runtime y aplicación.

### 1.1 Docker + docker-compose

**Archivos:**
- `backend/Dockerfile` (multi-stage build, Python 3.11-slim)
- `backend/docker-compose.yml`
- `backend/docker-compose.dev.yml`
- `frontend/Dockerfile.dev`

**Justificación:**

Docker actúa como capa de **IaaS virtualizada a nivel de contenedor**. El equipo define el sistema operativo base (Linux slim), las dependencias del runtime (Python 3.11, Node.js 18), las variables de entorno y los puertos expuestos. El proveedor de nube solo entrega la máquina virtual; Docker garantiza que el comportamiento sea idéntico en local, staging y producción.

```dockerfile
# backend/Dockerfile — multi-stage: builder → runtime
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim AS runtime
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

El equipo controla:
- Imagen base del SO (Debian slim)
- Versión del runtime (Python 3.11)
- Usuario sin privilegios root (`appuser`)
- Puertos y volúmenes montados

**Uso en desarrollo:**
```bash
docker-compose -f docker-compose.dev.yml up -d
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

---

### 1.2 GitHub Actions (CI/CD)

**Archivos:**
- `backend/.github/workflows/deploy.yml`
- `frontend/.github/workflows/deploy.yml`

**Justificación:**

GitHub Actions provee **cómputo efímero bajo demanda** (runners) para ejecutar el pipeline de integración y despliegue. El equipo define completamente qué comandos correr, en qué orden y bajo qué condiciones (branch, evento). El proveedor (GitHub/Microsoft) entrega la infraestructura de ejecución de los runners.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest       # IaaS: runner Linux gestionado por GitHub
    steps:
      - uses: actions/checkout@v4
      - name: Build frontend
        run: npm ci && npm run build
      - name: Deploy
        run: ./deploy.sh
```

El equipo controla:
- Trigger de despliegue (push a `main`)
- Comandos de build, test y deploy
- Secrets de entorno (tokens, URLs)

---

## 2. PaaS — Platform as a Service

> El proveedor gestiona el sistema operativo, red, escalado y runtime. El equipo de desarrollo solo sube el código y configura variables de entorno.

### 2.1 Render / Railway — Backend (FastAPI)

**Configuración:** Variables de entorno en `backend/.env.example`

**Justificación:**

El backend FastAPI se despliega en **Render** o **Railway** mediante conexión al repositorio GitHub. La plataforma detecta automáticamente el `Dockerfile`, construye la imagen, gestiona el escalado, los certificados HTTPS y el balanceo de carga. El equipo no administra servidores, kernels ni networking.

```
# backend/.env.example
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=https://tu-frontend.vercel.app
```

**Flujo de despliegue PaaS:**
```
1. git push origin main
      ↓
2. Render/Railway detecta el push
      ↓
3. Plataforma construye imagen Docker (automático)
      ↓
4. Deploy con zero-downtime (automático)
      ↓
5. Backend disponible en https://api.tu-dominio.com
```

El equipo controla:
- Código fuente y dependencias (`requirements.txt`)
- Variables de entorno
- Configuración CORS

La plataforma gestiona:
- Servidores físicos y virtuales
- Sistema operativo y actualizaciones
- Balanceo de carga y escalado horizontal
- Certificados SSL/TLS
- Routing y DNS

---

### 2.2 Vercel / Netlify — Frontend (React + Vite)

**Configuración:** `frontend/deploy.sh`, `frontend/.github/workflows/deploy.yml`

**Justificación:**

El frontend React compilado (bundle estático de Vite) se despliega en **Vercel** o **Netlify**. La plataforma detecta automáticamente el framework (Vite), ejecuta el build (`npm run build`) y distribuye los archivos estáticos via CDN global. El equipo solo configura variables de entorno (`VITE_API_URL`, `VITE_SUPABASE_URL`).

```bash
# Variables de entorno en Vercel/Netlify:
VITE_API_URL=https://api.tu-dominio.com
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Ventaja PaaS:** El build del frontend (transpilación de TypeScript/JSX, minificación, code splitting) es ejecutado por la plataforma sin configuración de servidores.

El equipo controla:
- Código fuente React
- Variables de entorno del build
- Rutas de la aplicación (`vite.config.js`)

La plataforma gestiona:
- CDN global (distribución geográfica)
- Build automático en cada commit
- Previews por Pull Request
- Certificados HTTPS y dominios

---

## 3. SaaS — Software as a Service

> El proveedor entrega una aplicación completamente funcional accesible via API. El equipo de desarrollo la consume como un servicio sin conocer ni controlar la infraestructura ni el código interno.

### 3.1 Supabase Auth

**Archivos:** `frontend/src/lib/supabaseClient.js`, `backend/src/core/security.py`

**Justificación:**

Supabase Auth es un servicio de **autenticación completo como SaaS**. El sistema lo consume como una "caja negra" a través de su SDK: se llama a `supabase.auth.signInWithPassword()` y el servicio devuelve un JWT firmado. El equipo no implementa hashing de contraseñas, almacenamiento de sesiones ni rotación de tokens — todo lo gestiona Supabase.

```javascript
// frontend/src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,   // SaaS endpoint
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Uso del SaaS de autenticación:
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@ejemplo.com',
  password: 'contraseña'
});
// data.session.access_token → JWT firmado por Supabase
```

```python
# backend/src/core/security.py
# Validación del JWT emitido por Supabase Auth (SaaS)
def verify_supabase_jwt(token: str) -> dict:
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False}
    )
    return payload
```

**El equipo consume de Supabase Auth:**
- Registro y login de usuarios
- Generación y renovación de JWT
- Almacenamiento seguro de contraseñas (bcrypt)
- Políticas de sesión y expiración de tokens

**El equipo NO gestiona:**
- Servidores de autenticación
- Base de datos de usuarios (gestionada por Supabase)
- Algoritmos de hashing
- Rotación de claves de firma JWT

---

### 3.2 Supabase Database (PostgreSQL)

**Archivos:** `backend/src/deps.py`, todos los archivos de servicios en `backend/src/services/`

**Justificación:**

La base de datos PostgreSQL es consumida como **SaaS** a través de la API PostgREST de Supabase. El equipo llama a métodos del SDK (`supabase.table().select().execute()`) y Supabase gestiona el servidor PostgreSQL, backups, índices de rendimiento y Row-Level Security.

```python
# backend/src/deps.py
from supabase import create_client, Client

def get_db() -> Client:
    return create_client(
        settings.SUPABASE_URL,   # SaaS endpoint
        settings.SUPABASE_KEY
    )

# backend/src/services/inventory_stock_service.py
async def get_stock_items(db: Client, local_id: str):
    response = db.table("inventory_stock") \
                 .select("*, products(name, category_id)") \
                 .eq("local_id", local_id) \
                 .execute()
    return response.data
```

**Row-Level Security (RLS) como SaaS:**

Supabase gestiona políticas de acceso a nivel de fila directamente en el motor de base de datos, sin que el equipo administre el servidor PostgreSQL:

```sql
-- Política RLS gestionada por Supabase (SaaS):
-- Los usuarios solo ven órdenes de su propio local
CREATE POLICY "users_see_own_orders"
ON orders FOR SELECT
USING (local_id IN (
  SELECT local_id FROM user_locals WHERE user_id = auth.uid()
));
```

**El equipo consume de Supabase DB:**
- Consultas SQL via API REST (PostgREST)
- Políticas RLS para seguridad multi-tenant
- Migraciones de esquema via dashboard o CLI
- Backups automáticos diarios

**El equipo NO gestiona:**
- Servidores PostgreSQL físicos
- Configuración de réplicas o failover
- Mantenimiento de índices
- Monitoreo de rendimiento del motor de DB

---

## Diagrama de Modelos Cloud

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DELIVERY CUSTOM APP                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SaaS (Consumido vía API)                 │   │
│  │                                                             │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │   Supabase Auth      │  │  Supabase Database       │   │   │
│  │  │  (JWT + Sessions)    │  │  (PostgreSQL + RLS)      │   │   │
│  │  │  SDK: supabase-js    │  │  SDK: supabase-py        │   │   │
│  │  └──────────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PaaS (Deploy automático)                 │   │
│  │                                                             │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Render / Railway    │  │   Vercel / Netlify       │   │   │
│  │  │  (Backend FastAPI)   │  │  (Frontend React+Vite)   │   │   │
│  │  │  puerto 8000, HTTPS  │  │  CDN global, HTTPS       │   │   │
│  │  └──────────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   IaaS (Control manual)                     │   │
│  │                                                             │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Docker + compose    │  │   GitHub Actions         │   │   │
│  │  │  (Contenedores)      │  │   (Runners CI/CD)        │   │   │
│  │  │  SO, runtime, red    │  │   ubuntu-latest          │   │   │
│  │  └──────────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ¿Por qué esta combinación de modelos?

| Decisión | Justificación técnica |
|----------|----------------------|
| **SaaS para Auth** | Delegar autenticación a Supabase elimina riesgos de seguridad en implementación propia (hashing, sesiones, tokens). Ahorra semanas de desarrollo. |
| **SaaS para DB** | PostgreSQL administrado reduce overhead de operaciones (backups, parches, réplicas). RLS centraliza la seguridad multi-tenant en la DB, no en el código. |
| **PaaS para deploy** | Render/Vercel permiten despliegue con `git push` sin gestionar servidores. Zero-downtime deployments y HTTPS automático reducen complejidad operacional. |
| **IaaS con Docker** | Garantiza portabilidad y reproducibilidad del entorno entre local, staging y producción. El equipo controla el runtime exacto (Python 3.11, non-root user). |
| **IaaS con GitHub Actions** | CI/CD totalmente controlado por el equipo. Flexibilidad para definir workflows de build, test y deploy sin dependencia de plataformas propietarias de CI. |
