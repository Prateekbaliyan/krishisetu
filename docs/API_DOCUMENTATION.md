# KrishiSetu — REST API Documentation

KrishiSetu exposes RESTful APIs secured with JSON Web Tokens (JWT) and Role-Based Access Control (`OPERATOR` and `MANAGER`).

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/login`
Authenticates a user and returns a signed JWT token.
- **Request Body:**
  ```json
  {
    "email": "operator.c07@krishisetu.in",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "email": "operator.c07@krishisetu.in",
      "fullName": "Dnyaneshwar Shinde",
      "role": "OPERATOR",
      "centreId": "centre-uuid",
      "centre": { "code": "C07", "name": "Ausa Central Collection Centre" }
    }
  }
  ```

### `GET /api/auth/me`
Returns the currently authenticated user session.
- **Headers:** `Authorization: Bearer <token>`

---

## 2. Dashboard (`/api/dashboard`)

### `GET /api/dashboard/summary?centreId={optional}`
Aggregates live database metrics for the executive dashboard:
- Today's purchases count, kg, and tonnes
- Today's purchase value (INR)
- Pending payment amount and approved purchase counts
- Flagged lots in review queue
- Crop-wise volume breakdown (Soybean vs Tur)
- Centre-wise breakdown across all 22 centres
- Recent 10 transactions

---

## 3. Farmer Registry (`/api/farmers`)

### `GET /api/farmers?search={query}&village={village}&centreId={centreId}`
Searches and filters registered farmers. Bank account numbers are returned masked (`XXXX-XXXX-1234`). Aadhaar numbers are never collected or stored.

### `GET /api/farmers/:id`
Retrieves detailed farmer profile with historical purchases, payments, and metrics.

### `POST /api/farmers` *(Manager Only)*
Registers a new farmer member.

---

## 4. Daily Price Board (`/api/prices`)

### `GET /api/prices/active`
Returns currently active published rates by crop and grade.

### `POST /api/prices/publish` *(Manager Only)*
Publishes new central procurement rates. All collection centres synchronize to this rate. Past purchases retain their original rate.

---

## 5. Collection Purchases (`/api/purchases`)

### `POST /api/purchases`
Creates a new procurement purchase entry.
- **Validations:** Gross > Tare, Moisture $\ge 0$, Rate $> 0$.
- **Calculations:** Decimal-safe arithmetic for Net Weight, Deduction %, and Payable Amount.
- **Automated Surveillance:** Runs the 3 anomaly checks.
- **SMS:** Emits simulated Marathi notification.
- **Audit:** Records SHA-256 chained event.

### `GET /api/purchases/:slipNumber`
Retrieves full purchase slip details.

### `POST /api/purchases/:id/review` *(Manager Only)*
Allows an authorized manager to approve or reject a flagged purchase with supervisor justification notes.

---

## 6. Offline Queue Batch Synchronization (`/api/sync`)

### `POST /api/sync/batch`
Synchronizes offline purchases recorded in Dexie IndexedDB.
- **Features:** Idempotency key checking, duplicate prevention, server recalculation of math, anomaly detection, SHA-256 hash chaining.

---

## 7. Direct Bank Payment Runs (`/api/payments`)

### `GET /api/payments/eligible` *(Manager Only)*
Lists approved purchases with verified bank accounts, grouped by farmer.

### `POST /api/payments/create-run` *(Manager Only)*
Generates a payment run batch, creates individual payment records, links purchases, and generates a bulk clearing CSV file.

### `GET /api/payments/runs/:id/download-csv` *(Manager Only)*
Downloads the generated CSV file.

### `POST /api/payments/runs/:id/simulate-bank` *(Manager Only)*
Simulates bank settlement response (`PAID` or `FAILED`).

---

## 8. Stock & Dispatches (`/api/stock`)

### `GET /api/stock/summary`
Calculates real warehouse position: $\text{Current Stock} = \text{Inward} - \text{Dispatched} - \text{Transit Loss}$.

### `POST /api/stock/dispatches`
Records a truck dispatch from a village collection centre to a central warehouse or processing mill.

---

## 9. Cryptographic Audit Log (`/api/audit`)

### `GET /api/audit/logs` *(Manager Only)*
Returns chronological append-only audit entries with event hashes and previous hashes.

### `GET /api/audit/verify-chain` *(Manager Only)*
Recalculates every SHA-256 hash in the chain and cryptographically validates the entire sequence.

