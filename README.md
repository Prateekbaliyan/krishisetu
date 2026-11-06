# KrishiSetu – Farmer Procurement & Payment Management System

[![Build & Test](https://img.shields.io/badge/tests-44%20passed-success?style=flat-square)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](.)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](.)
[![Node](https://img.shields.io/badge/Node.js-22%2B-green?style=flat-square&logo=nodedotjs)](.)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](.)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwindcss)](.)
[![Offline First](https://img.shields.io/badge/Offline--First-Dexie.js%20IndexedDB-orange?style=flat-square)](.)

**KrishiSetu** is a production-quality, full-stack agricultural procurement and direct farmer payment management platform designed for Farmer Producer Companies (FPCs). It bridges the operational divide between remote village collection centres and the central corporate office.

The reference production deployment serves a major Farmer Producer Company headquartered in **Latur, Maharashtra**, connecting:
- **6,200** registered farmer members
- **140** villages across Latur district
- **22** village collection centres (Mandi hubs)
- **60** staff members
- **45,000** purchases and **15,000 tonnes** annual procurement

---

## 🌾 Core Workflows & Implemented Screens

| Screen | Key Features |
| :--- | :--- |
| **1. Login** | Professional enterprise login with JWT auth, RBAC, and one-click quick demo role switcher for instant evaluation. |
| **2. Operations Dashboard** | Real-time database metrics: today's intake (kg & tonnes), total procurement value, pending payments, approved lots, flagged lots, centre-wise bar charts, crop-wise pie charts, and offline sync status. |
| **3. Farmer Registry** | Full registry with search, village/centre filters, masked bank accounts (`XXXX-XXXX-1234`), land area, and profile view with full purchase and payment history. **Strict compliance: Aadhaar is never collected or stored.** |
| **4. Collection Entry** | Fast mobile-first intake workflow for low-end Android phones in outdoor sunlight. Large numeric touch targets, farmer selection, crop (Soybean/Tur) & grade selection, and real-time live arithmetic calculations. |
| **5. AI Photo Verification** | Actual image analysis for digital weighing scales and grain moisture meters using Google Gemini Vision API (with configurable mock fallback). Displays side-by-side comparison, tolerance verification ($\pm 2.0\text{ kg}$, $\pm 0.5\%$), and confidence score. **Never fabricates OCR results and never silently overwrites manual inputs.** |
| **6. Digital Slip & SMS** | Generates unique slip number (e.g. `C07-24518`). Printable receipt with clean print stylesheet, download PDF support, and simulated Marathi SMS delivery with delivery tracking. |
| **7. Daily Price Board** | Central Office publishes daily rates by crop and grade. All 22 centres synchronize immediately. Past created purchase records retain their original rate. |
| **8. Payment Run** | Groups approved purchases by farmer, validates verified bank details, excludes flagged lots, prevents duplicate inclusion, and generates bank bulk upload CSV. Includes simulated bank clearing callbacks (`PAID`/`FAILED`). |
| **9. Stock Management** | Real procurement inward minus truck dispatches minus transit moisture dry-down loss = current warehouse position. Full truck dispatch logging with driver and destination. |
| **10. Anomaly Review** | Review queue for rule-based surveillance (Yield benchmark violation, 1-hour duplicate delivery, uniform moisture streak). Allows managers to approve or reject with audit notes. |
| **11. Audit Trail** | Cryptographically chained append-only event ledger using **SHA-256 hash chaining**. Includes interactive one-click chain integrity verification. |

---

## 🎨 Design System Palette

Constructed according to the strict agricultural SaaS design specifications:

- **Main Background:** `#F7F9F4`
- **Card Background:** `#FFFFFF`
- **Primary Green:** `#527A50`
- **Dark Forest Green:** `#24452F`
- **Soft Sage:** `#E6EFE2`
- **Border:** `#E5EAE1`
- **Main Text:** `#202B22`
- **Secondary Text:** `#738071`
- **Warning:** Muted Amber (`#D97706` / `#FEF3C7`)
- **Error:** Restrained Red (`#DC2626` / `#FEE2E2`)
- **Typography:** `Inter` for English data tables & controls; `Noto Sans Devanagari` for Marathi SMS notifications.

---

## 🔑 Demo Accounts (Instant Sign-In)

The login screen includes one-click demo credentials for immediate testing:

| Role | Email | Password | Scope / Centre |
| :--- | :--- | :--- | :--- |
| **Centre Operator** | `operator.c07@krishisetu.in` | `password123` | Ausa Central Collection Centre (`C07`) |
| **Office Manager** | `manager@krishisetu.in` | `password123` | Central Office (All 22 Centres) |

---

## 🧮 Procurement Calculation Formulas

All procurement calculations use decimal-safe arithmetic. Weights are rounded to **1 decimal place**, and currency is rounded to **2 decimal places**:

$$\text{Actual Weight} = \text{Gross Weight} - \text{Tare Weight}$$
$$\text{Moisture Deduction \%} = \max(0, \text{Moisture} - 12) \times 1\%$$
$$\text{Net Weight} = \text{Actual Weight} \times \left(1 - \frac{\text{Deduction \%}}{100}\right)$$
$$\text{Total Payable Amount} = \frac{\text{Net Weight} \times \text{Rate per Quintal}}{100}$$

### Mandatory Seed Purchases Verification
The database seed script implements the exact sample purchases mandated in the specification:

1. **`C07-24518` | Sunil Jadhav | Soybean**
   - Gross: 1250.0 kg | Tare: 18.0 kg | Actual: 1232.0 kg
   - Moisture: 11.5% | Deduction: 0.0% | Net: **1232.0 kg**
   - Rate: ₹4850.00/quintal | Payable: **₹59,752.00**
2. **`C07-24519` | Kamal Shinde | Soybean**
   - Gross: 860.0 kg | Tare: 12.0 kg | Actual: 848.0 kg
   - Moisture: 14.0% | Deduction: 2.0% | Net: **831.0 kg**
   - Rate: ₹4850.00/quintal | Payable: **₹40,303.50**
3. **`C12-08876` | Mohan Biradar | Tur**
   - Gross: 640.0 kg | Tare: 10.0 kg | Actual: 630.0 kg
   - Moisture: 10.0% | Deduction: 0.0% | Net: **630.0 kg**
   - Rate: ₹7200.00/quintal | Payable: **₹45,360.00**

---

## 📱 Simulated Marathi SMS Delivery

Upon generating a slip, a simulated SMS notification is formatted and logged in compliance with Indian telecom DLT requirements:

> *"नमस्कार Sunil Jadhav, आपल्या सोयाबीन खरेदीची पावती C07-24518. एकूण वजन: 1250.0 किलो, निव्वळ वजन: 1232.0 किलो, दर: ₹4850.00/क्विंटल, देय रक्कम: ₹59752.00. काही तफावत असल्यास केंद्राशी संपर्क साधा."*

*(Clearly labeled as a simulation; does not claim actual carrier transmission).*

---

## ⚡ Offline-First Architecture & SHA-256 Hash Chaining

1. **Dexie.js IndexedDB:** When internet connectivity is lost, the operator can continue weighing and issuing slips without interruption. Transactions are written to local IndexedDB (`offlineQueue`).
2. **Idempotency Keys:** Every purchase carries a client-generated UUID (`idempotencyKey`). Duplicate transmissions are acknowledged safely without creating duplicate financial records.
3. **Automated Resumption:** When connectivity returns, the application auto-detects `online` events and triggers background batch synchronization.
4. **Append-Only Cryptographic Audit Log:** Every critical action computes an immutable SHA-256 hash linked to the previous block's hash.
5. **Documented Architectural Limitation:** Client-generated timestamps and local storage cannot be considered independently tamper-proof on a compromised physical device. Security and non-repudiation are guaranteed by the server independently recalculating weights, validating idempotency, applying `serverReceivedTimestamp`, and maintaining the authoritative server hash chain.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js v18+ (tested on Node v25)
- npm v9+

### Installation & Launch

```bash
# 1. Install root, backend, and frontend dependencies
npm install
npm --prefix server install
npm --prefix client install

# 2. Synchronize SQLite local database and seed sample records
npm run db:push
npm run db:seed

# 3. Run automated tests (30 tests covering calculations, RBAC, offline sync, SHA-256 chain)
npm test

# 4. Start Development Servers
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: Frontend Client (port 5173)
npm run dev:client
```

Open your browser at **`http://localhost:5173`**.

---

## 🧪 Automated Test Suite

Run the full automated test suite:
```bash
# Run backend tests (Supertest + Vitest)
npm run test:server

# Run frontend tests (Vitest)
npm run test:client

# Run all test suites
npm test
```

### Test Coverage Highlights (44 Passing Automated Tests)
- ✅ **Calculations:** Moisture deduction thresholds, decimal-safe net weight & amount arithmetic, invalid weight rejection (Gross $\le$ Tare, negative tare, excessive moisture).
- ✅ **AI Mismatch Backend Enforcement:** Independent backend comparison against scale ($\pm 2.0\text{ kg}$) and moisture ($\pm 0.5\%$) tolerances; blocks operator bypass; requires authorized Manager approval with review reason and reviewer ID.
- ✅ **Daily Price Validation:** Backend-only rate enforcement strictly looks up central published daily rates; completely ignores client-supplied rates; rejects unpublished/invalid crops.
- ✅ **Offline Batch Sync:** Idempotency verification via UUID keys, conflict handling, server formula recalculation, duplicate sync rejection.
- ✅ **Security, RBAC & Centre Boundaries:** Operator restricted to assigned collection centre (blocked from other centre slips, purchases, and dispatches); production JWT secret validation.
- ✅ **Payment Run Safety & Atomicity:** Database transactions prevent race conditions; excludes flagged or unapproved purchases; verifies bank details before CSV generation; prevents duplicate payment assignments.
- ✅ **Deep Image Upload Security:** Binary magic-byte inspection rejects fake image extensions; path traversal prevention with UUID filenames; protected `/uploads` static route.
- ✅ **Cryptographic Audit:** Full SHA-256 hash chain verification across all sequential transactions with documented physical device limitations.

---

## 📚 Technical Documentation & Deployment Guides

- 📘 [Technical Design Document (TDD)](./docs/TECHNICAL_DESIGN_DOCUMENT.md) — Detailed architecture, subsystem designs, mathematical formulas, and limitation analysis.
- 🚀 [Production Deployment Guide](./docs/DEPLOYMENT.md) — Render, Vercel, Supabase PostgreSQL, environment variables, and Gemini API setup.
- 📡 [API Documentation](./docs/API_DOCUMENTATION.md) — Complete REST endpoint specifications, request/response schemas, and error codes.
- 🏗️ [System Architecture & Specifications](./docs/ARCHITECTURE.md) — Data flow diagrams, offline-first sync lifecycle, and security model.

---

## 🚢 Production Deployment (Vercel + Render + Supabase)

See detailed instructions in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md):

- **Database:** Supabase Managed PostgreSQL (`prisma/schema.postgresql.prisma`)
- **Backend API:** Render Web Service (`render.yaml`, Health check: `/api/health`)
- **Frontend SPA:** Vercel Hosting (`vercel.json`)

---

## 📂 Project Structure

```
krishisetu/
├── client/                     # Frontend React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── components/         # Reusable UI (Card, Button, Badge, Input, Modal)
│   │   ├── context/            # AuthContext & SyncContext
│   │   ├── lib/                # Client calculation engine & UUID generator
│   │   ├── pages/              # Screens 1 to 9 (Login, Dashboard, Entry, Slips, etc.)
│   │   ├── services/           # REST API client, Dexie db & SyncManager
│   │   └── types/              # Full TypeScript interface definitions
│   └── public/                 # Manifest & Service Worker for offline PWA
├── server/                     # Backend Node.js + Express API
│   ├── prisma/                 # Prisma schemas (SQLite & PostgreSQL) & seed.ts
│   ├── src/
│   │   ├── lib/                # Calculations, SHA-256 crypto, Vision AI, Bank CSV, SMS
│   │   ├── middleware/         # JWT Auth, RBAC, Multer photo uploads
│   │   ├── routes/             # REST routes (auth, dashboard, farmers, purchases, sync, etc.)
│   │   └── services/           # AuditService & AnomalyService
│   └── tests/                  # Supertest & Vitest end-to-end integration tests
├── docs/                       # Architecture, Deployment & API documentation
├── .env.example                # Sample environment variables configuration
├── package.json                # Root monorepo workspace configuration
└── README.md                   # Project documentation
```

---

## 📜 License
KrishiSetu is developed for Farmer Producer Companies under standard enterprise open-source licensing.

