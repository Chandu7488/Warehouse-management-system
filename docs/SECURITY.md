# StockPilot WMS - Security Policy & Hardening Controls

This document details the security architecture, baseline controls, threat boundaries, and audit policies enforced across StockPilot WMS.

---

## 1. Authentication & Session Security

- **Dual-Token Architecture**:
  - **Access Token**: Short-lived (15 minutes default) signed with `JWT_ACCESS_SECRET`. Carries user identity, email, and role.
  - **Refresh Token**: Long-lived (7 days default) signed with `JWT_REFRESH_SECRET`. Stored as a hashed token in MongoDB and delivered via an `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth` cookie.
- **Credential Protection**:
  - Passwords are encrypted using `bcryptjs` with a cost factor of 10.
  - Passwords are never serialized into JSON responses or saved to logs (`select: false` on Mongoose user schema).
- **Session Revocation**:
  - Logout explicitly clears the refresh token cookie and deletes the corresponding database session record.
  - Deactivated users have their sessions revoked immediately upon authentication middleware inspection.

---

## 2. Authorization & Role-Based Access Control (RBAC)

Every route in StockPilot WMS is guarded by two mandatory middlewares:
1. `authenticate`: Verifies cryptographic validity and non-expiration of the JWT token.
2. `authorize(permission)`: Checks whether the active user's assigned role possesses the required permission.

### Permission Matrix

| Resource Domain | Operator | Warehouse Manager | Quality Control | Auditor | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Master Data** (Products, Categories, Units) | Read | Read / Write | Read | Read | Read / Write |
| **Trading Partners** (Suppliers, Customers) | Read | Read / Write | Read | Read | Read / Write |
| **Facilities & Locations** | Read | Read / Write | Read | Read | Read / Write |
| **Inventory Balances & Ledger** | Read | Read / Write | Read | Read | Full Control |
| **Inbound & Goods Receipts (GRN)** | Receive / Putaway | Full Inbound | QA Inspection | Read | Full Control |
| **Outbound, Wave Picking & Shipments** | Pick / Pack | Full Outbound | Read | Read | Full Control |
| **Warehouse Transfers & Replenishment** | Move / Receive | Full Transfers | Read | Read | Full Control |
| **Cycle Counts & Stock Audits** | Count Results | Plan / Reconcile | Read | Read / Audit | Full Control |
| **Stock Adjustments & Scrap Write-Off** | Propose Draft | Propose Draft | Scrap QA | Audit | Approve / Post |
| **Executive Reports & Analytics** | Restricted | Read | Read | Full Read | Full Control |
| **User Management & System Roles** | Denied | Denied | Denied | Denied | Full Control |

---

## 3. Injection Prevention & Input Sanitization

- **NoSQL Injection Resistance**:
  - All input vectors (`req.body`, `req.params`, `req.query`) are strictly validated against strict Zod schemas before reaching business logic.
  - Objects attempting MongoDB query operator injections (e.g., `{"$ne": null}`, `{"$gt": ""}`) fail schema type checking with HTTP 422 Unprocessable Entity.
- **Database Parameterization**:
  - All queries use Mongoose model helpers (`findById`, `findOne`, `create`, `aggregate`) with typed parameterization.
  - Arbitrary string concatenation into query filters is prohibited.
- **Cross-Site Scripting (XSS)**:
  - React client automatically escapes dynamic variables before rendering to the DOM.
  - `dangerouslySetInnerHTML` is disallowed.

---

## 4. HTTP Headers & Rate Limiting

- **Security Headers (Helmet)**:
  - `X-Content-Type-Options: nosniff` (prevents MIME sniffing).
  - `X-Frame-Options: SAMEORIGIN` (prevents clickjacking).
  - `X-DNS-Prefetch-Control: off`
  - `X-Download-Options: noopen`
- **Rate Limiting**:
  - General API rate limiter limits requests to 1,000 requests per 15-minute window per IP.
  - Auth rate limiter throttles brute-force login attempts.
- **CORS Configuration**:
  - CORS is restricted to the explicit `CLIENT_URL` origin with `credentials: true`. Wildcards (`*`) are disallowed with credentials.

---

## 5. Ledger Integrity & ACID Concurrency

- **Immutable Stock Ledger**:
  - The `stockledgerentries` collection is append-only.
  - Physical inventory balances (`stockbalances`) cannot be updated directly; every modification must pass through `postMovements` in `stockPosting.service.js`.
- **Multi-Document ACID Transactions**:
  - Multi-bin movements, wave pick allocations, and count reconciliations execute within MongoDB multi-document transactions with snapshot isolation.
  - If any movement violates business rules (such as insufficient available stock), the entire transaction aborts without balance drift.

---

## 6. Vulnerability Disclosure & Audit

To report security issues or vulnerabilities, please contact the StockPilot security team at `security@stockpilot.local`.
