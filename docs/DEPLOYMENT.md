# KrishiSetu — Production Deployment Guide

This guide provides deployment instructions for running KrishiSetu across **Vercel** (Frontend), **Render** (Backend API), and **Supabase PostgreSQL** (Production Database), as well as running the local standalone development environment.

---

## 1. Architecture Overview

- **Frontend:** React 18 + Vite SPA deployed on **Vercel**
- **Backend API:** Node.js + Express + TypeScript on **Render**
- **Database:** Managed **PostgreSQL** hosted on **Supabase** (or Neon / Render Postgres)
- **Local Fallback:** Zero-config SQLite database (`server/prisma/dev.db`) for immediate offline/local evaluation and CI/CD testing.

---

## 2. Supabase PostgreSQL Setup

1. Create a project at [supabase.com](https://supabase.com/).
2. Navigate to **Project Settings > Database > Connection String > URI**.
3. Copy your connection URI (select **Direct Connection** on port 5432 or **Session Pooler** on port 5432):
   ```bash
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
   ```
4. Run migrations using Prisma PostgreSQL schema:
   ```bash
   cd server
   npx prisma db push --schema=prisma/schema.postgresql.prisma
   ```
5. Seed initial data:
   ```bash
   npm run db:seed
   ```

---

## 3. Render Backend Deployment

1. Create a new **Web Service** on [render.com](https://render.com/).
2. Connect your repository.
3. Configure settings:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build && npx prisma db push --schema=prisma/schema.postgresql.prisma`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `DATABASE_URL`: Your Supabase connection string
   - `JWT_SECRET`: A secure 32+ character secret string
   - `CLIENT_URL`: Your frontend Vercel domain (e.g. `https://krishisetu.vercel.app`)
   - `GEMINI_API_KEY`: Your Google AI Studio API key (optional for vision OCR)
   - `VISION_PROVIDER`: `gemini` (or `mock` for testing)

---

## 4. Vercel Frontend Deployment

1. Create a new project on [vercel.com](https://vercel.com/).
2. Connect your repository.
3. Configure settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Set Environment Variables:
   - `VITE_API_BASE_URL`: Your deployed Render backend URL (e.g. `https://krishisetu-api.onrender.com/api`)
5. Deploy.

---

## 5. Local Standalone Development (Zero External Dependencies)

To run the application locally without requiring an active PostgreSQL instance:

```bash
# 1. Install dependencies across monorepo
npm install
npm --prefix server install
npm --prefix client install

# 2. Push SQLite schema and seed sample data
npm run db:push
npm run db:seed

# 3. Run automated test suites (all 30 tests)
npm test

# 4. Start local development servers
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: Frontend Client (port 5173)
npm run dev:client
```

Open your browser at `http://localhost:5173`.
You can sign in immediately using one of the demo accounts:
- **Centre Operator:** `operator.c07@krishisetu.in` / `password123`
- **Office Manager:** `manager@krishisetu.in` / `password123`

---

## 6. Health Check Endpoint

KrishiSetu provides an automated health check endpoint suitable for container orchestration (Kubernetes, Render, AWS ECS):

```
GET /api/health
```

Sample 200 OK Response:
```json
{
  "status": "healthy",
  "system": "KrishiSetu API",
  "version": "1.0.0",
  "timestamp": "2026-11-05T00:30:00.000Z",
  "uptimeSeconds": 1420,
  "environment": "production"
}
```

