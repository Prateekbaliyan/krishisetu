# KrishiSetu — Production Deployment Guide

**GitHub Repository:** [https://github.com/Prateekbaliyan/krishisetu](https://github.com/Prateekbaliyan/krishisetu)  
**Live Application (Frontend):** [https://krishisetu-gules-nine.vercel.app/](https://krishisetu-gules-nine.vercel.app/)  
**Live Backend API:** [https://krishisetu-aktz.onrender.com](https://krishisetu-aktz.onrender.com)  

This guide provides deployment instructions for running KrishiSetu across **Vercel** (Frontend), **Render** (Backend API), and **Supabase PostgreSQL** (Production Database), as well as running the local standalone development environment.

---

## 1. Architecture Overview

- **Frontend:** React 18 + Vite SPA deployed on **Vercel** (`https://krishisetu-gules-nine.vercel.app/`)
- **Backend API:** Node.js + Express + TypeScript on **Render** (`https://krishisetu-aktz.onrender.com`)
- **Production Database:** Managed **PostgreSQL** hosted on **Supabase** (IPv4 Connection Pooler mode)
- **Local Fallback:** Zero-config SQLite database (`server/prisma/dev.db`) for immediate offline/local evaluation and CI/CD testing.

---

## 2. Supabase PostgreSQL Setup & Dual Prisma Schema Architecture

KrishiSetu uses a dual Prisma schema architecture to support zero-dependency local development alongside scalable cloud SQL:
- **Local Development / CI:** `server/prisma/schema.prisma` (SQLite `dev.db`), managed via `npm run db:push`.
- **Cloud Production:** `server/prisma/schema.postgresql.prisma` (PostgreSQL), managed via `npx prisma db push --schema=prisma/schema.postgresql.prisma`.

### PostgreSQL Database Configuration Steps:

1. Create a project at [supabase.com](https://supabase.com/).
2. Navigate to **Project Settings > Database > Connection String > URI** or click the top header **Connect** button.
3. Select **Session Pooler (IPv4)** on port 5432:
   > **Important:** Render free-tier instances run on outbound IPv4 networking. Supabase's direct connection domain resolves to IPv6-only, which causes `Error P1001: Can't reach database server`. Using the Supabase IPv4 Pooler domain (`aws-0-[REGION].pooler.supabase.com:5432`) guarantees seamless connectivity from Render.
   ```bash
   DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[YOUR-REGION].pooler.supabase.com:5432/postgres"
   ```
4. Push PostgreSQL schema to the cloud database:
   ```bash
   cd server
   npx prisma db push --schema=prisma/schema.postgresql.prisma
   ```
5. Seed initial data into cloud PostgreSQL:
   ```bash
   npm run db:seed
   ```
   > **Verification of Production Seeding with PostgreSQL:** The production seeding script (`server/prisma/seed.ts`) was physically verified against Supabase PostgreSQL. By executing `npx prisma generate --schema=prisma/schema.postgresql.prisma` followed by `npm run db:seed` with `DATABASE_URL` pointing to the cloud PostgreSQL database, all seed records (5 collection centres, 2 users, daily price boards, 30 farmers, verified purchases, flagged anomaly records, completed payment runs, stock dispatches, and SHA-256 chained audit logs) are populated directly into PostgreSQL rather than local SQLite. All financial and weight calculations coerce Prisma PostgreSQL `Decimal` fields to numbers via `Number(p.totalAmount || 0)` before summation, preventing JavaScript string-concatenation errors (`NaN`) during payment batch creation on PostgreSQL.

---

## 3. Render Backend Deployment

1. Create a new **Web Service** on [render.com](https://render.com/).
2. Connect the GitHub repository: `https://github.com/Prateekbaliyan/krishisetu`.
3. Configure service settings:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:**
     ```bash
     npm install && npx prisma generate --schema=prisma/schema.postgresql.prisma && npm run build && npx prisma db push --schema=prisma/schema.postgresql.prisma && npm run db:seed
     ```
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Configure Environment Variables in the Render Dashboard (**Environment > Add Environment Variable**):
   - `NODE_ENV`: `production` (Triggers fail-fast JWT security checks on startup)
   - `PORT`: `5000` (Render binds dynamically; Express listens on `process.env.PORT || 5000`)
   - `DATABASE_URL`: Your Supabase PostgreSQL Pooler connection string (`postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`)
   - `JWT_SECRET`: A cryptographically secure secret (minimum 32 characters; server refuses to boot if missing, shorter than 32 chars, or using default dev key)
   - `CLIENT_URL`: `https://krishisetu-gules-nine.vercel.app` (Express CORS middleware reflects this origin with `credentials: true`)
   - `GEMINI_API_KEY`: Google Gemini API key from [Google AI Studio](https://aistudio.google.com/). Stored exclusively on backend server; never exposed to frontend code.
   - `GEMINI_MODEL`: `gemini-3.5-flash-lite` (Default multimodal model for weighing scale and moisture meter OCR)
   - `VISION_PROVIDER`: `gemini` (Defaults to `gemini` when `GEMINI_API_KEY` is set; safely falls back to `unconfigured` if key is omitted)
   - `GEMINI_TIMEOUT_MS`: `15000` (15-second AbortController timeout preventing request hanging)

---

## 4. Vercel Frontend Deployment

1. Create a new project on [vercel.com](https://vercel.com/).
2. Import repository `https://github.com/Prateekbaliyan/krishisetu`.
3. Configure build settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client` *(Crucial: do not leave as project root)*
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Configure Environment Variable:
   - `VITE_API_BASE_URL`: `https://krishisetu-aktz.onrender.com/api`
5. Click **Deploy**.
6. SPA Routing Verification: The repository includes `client/vercel.json` with rewrite rule `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}`. This ensures direct URL navigations and browser refreshes on subroutes (`/purchases`, `/anomaly-review`, `/payment-runs`) resolve without 404 errors.

---

## 5. Local Standalone Development (Zero External Dependencies)

To run the application locally without requiring cloud PostgreSQL or network dependencies:

```bash
# 1. Install dependencies across monorepo
npm install
npm --prefix server install
npm --prefix client install

# 2. Push SQLite schema and seed baseline sample data
npm run db:push
npm run db:seed

# 3. Run automated test suites (all 60 tests: 56 backend in server, 4 frontend in client)
npm test

# 4. Start local development servers
# Note: The backend API and frontend client run in separate terminals.

# Terminal 1: Backend API (port 5000, with hot reload via tsx)
npm run dev:server

# Terminal 2: Frontend Client (port 5173, with hot reload via Vite)
npm run dev:client

# Alternative for Windows:
# You can double-click `start.bat`. It launches the backend server (`npm --prefix server start` on port 5000) and frontend client (`npm --prefix client run dev -- --host` on port 5173) in two separate command windows and opens `http://localhost:5173` in your default browser. (Ensure you have run `npm run build:server` at least once before using start.bat so dist/index.js is available).
```

---

## 6. Seeded User Accounts & Role Separation

Both local SQLite (`server/prisma/dev.db`) and production Supabase PostgreSQL are seeded with standard baseline accounts by `server/prisma/seed.ts`. On the login screen (`https://krishisetu-gules-nine.vercel.app/` or `http://localhost:5173`), one-click demo fill buttons are provided for instant evaluation:

### Production Reviewer & Local Evaluation Credentials:

| Role | Email | Password | Assigned Centre | System Permissions & Scope |
|---|---|---|---|---|
| **Office Manager** | `manager@krishisetu.in` | `password123` | *All Centres (Global)* | Full company-wide visibility across all 22 collection centres, daily price publishing, manual approval of AI scale/moisture variances, anomaly review queue resolution, atomic payment run creation, and bank bulk payment CSV export. |
| **Centre Operator** | `operator.c07@krishisetu.in` | `password123` | Ausa Collection Centre (`C07`) | Daily procurement slip generation, electronic scale & moisture meter photo upload, offline queue sync. Access strictly restricted to Centre C07; cross-centre operations blocked by RBAC boundary. |

---

## 7. Automated Test Suite Verification

All 60 automated tests were physically executed against the codebase and verified 100% passing:

```text
✓ server/tests/security-fixes.test.ts (30 tests passed)
✓ server/tests/e2e-workflow.test.ts (15 tests passed)
✓ server/tests/calculations.test.ts (9 tests passed)
✓ server/tests/bankCsv.test.ts (2 tests passed)
✓ client/tests/calculations.test.ts (4 tests passed)

Total: 60 automated tests passing across 5 test suites.
```

---

## 8. Health Check Endpoint

KrishiSetu provides an automated health check endpoint suitable for container orchestration and uptime monitoring:

```http
GET /api/health
```

Sample `200 OK` Response:
```json
{
  "status": "healthy",
  "system": "KrishiSetu API",
  "version": "1.0.0",
  "timestamp": "2026-11-07T18:15:00.000Z",
  "uptimeSeconds": 2480,
  "environment": "production"
}
```
