# Incisive Admin Portal Backend — Technical Documentation

## 1. Project Structure

**Framework:** NestJS 10.3 | **Language:** TypeScript 5.3 | **ORM:** Prisma 5.22 | **Database:** PostgreSQL

```
incisive-admin-portal-be/
│
├── src/
│   ├── main.ts                         # Application entry point & bootstrap
│   ├── app.module.ts                   # Root module with all imports
│   │
│   ├── auth/                           # Authentication Module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts          # /auth endpoints
│   │   ├── auth.service.ts             # Login, register, refresh, logout
│   │   ├── constants/
│   │   │   └── roles.enum.ts           # ADMIN, USER, VIEWER roles
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts     # @Public() - skip auth
│   │   │   └── roles.decorator.ts      # @Roles() - require roles
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   └── auth-response.dto.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # Global JWT validation
│   │   │   ├── jwt-refresh.guard.ts    # Refresh token guard
│   │   │   └── roles.guard.ts          # Role-based access
│   │   └── strategies/
│   │       ├── jwt.strategy.ts         # Access token strategy
│   │       └── jwt-refresh.strategy.ts # Refresh token strategy
│   │
│   ├── users/                          # User Management Module
│   │   ├── users.module.ts
│   │   ├── users.controller.ts         # /users endpoints
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── admin/                          # Admin Module
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts         # /admin endpoints
│   │   ├── admin.service.ts
│   │   └── dto/
│   │       ├── admin-user.dto.ts
│   │       ├── dashboard-stats.dto.ts
│   │       └── query-params.dto.ts
│   │
│   ├── tables/                         # Dynamic Tables Module
│   │   ├── tables.module.ts
│   │   ├── tables.controller.ts        # /tables endpoints
│   │   ├── tables.service.ts           # Generic CRUD for any table
│   │   ├── tables.enum.ts              # AllowedTable enum
│   │   └── dto/
│   │       └── table.dto.ts
│   │
│   ├── labs/                           # Labs Lookup Module
│   │   ├── labs.module.ts
│   │   ├── labs.controller.ts          # /labs endpoints
│   │   └── labs.service.ts
│   │
│   ├── practices/                      # Practices Lookup Module
│   │   ├── practices.module.ts
│   │   ├── practices.controller.ts     # /practices endpoints
│   │   └── practices.service.ts
│   │
│   ├── products/                       # Products Lookup Module
│   │   ├── products.module.ts
│   │   ├── products.controller.ts      # /products endpoints
│   │   └── products.service.ts
│   │
│   ├── dental-groups/                  # Dental Groups Lookup Module
│   │   ├── dental-groups.module.ts
│   │   ├── dental-groups.controller.ts # /dental-groups endpoints
│   │   └── dental-groups.service.ts
│   │
│   ├── health/                         # Health Check Module
│   │   ├── health.module.ts
│   │   └── health.controller.ts        # /health endpoints
│   │
│   ├── prisma/                         # Database Module
│   │   ├── prisma.module.ts            # Global database module
│   │   ├── prisma.service.ts           # Prisma client wrapper
│   │   └── run-migrations.ts           # SQL migration runner
│   │
│   ├── common/                         # Shared Utilities
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts    # Global error handler
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts      # Request/response logging
│   │   │   └── transform.interceptor.ts    # Response wrapper
│   │   ├── guards/
│   │   │   ├── ownership.guard.ts          # Resource ownership check
│   │   │   └── rate-limit.guard.ts         # Rate limiting
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts   # @CurrentUser()
│   │   │   └── request-id.decorator.ts     # @RequestId()
│   │   ├── interfaces/
│   │   │   └── api-response.interface.ts
│   │   └── constants/
│   │       └── error-messages.constant.ts
│   │
│   └── config/                         # Configuration
│       ├── app.config.ts               # Port, prefix, throttle
│       ├── database.config.ts          # DB connection
│       ├── jwt.config.ts               # JWT secrets & expiry
│       └── swagger.config.ts           # OpenAPI config
│
├── prisma/
│   ├── schema.prisma                   # Database schema definition
│   └── migrations/                     # SQL migration files
│       └── 001_create_users_table.sql
│
├── dist/                               # Compiled output (generated)
├── node_modules/                       # Dependencies
│
├── .env                                # Environment variables (local)
├── .env.example                        # Environment template
├── package.json                        # Dependencies & scripts
├── tsconfig.json                       # TypeScript config
├── nest-cli.json                       # NestJS CLI config
└── Dockerfile                          # Container build
```

---

## 2. Authentication System

**File:** `src/auth/auth.service.ts`

### Endpoints

- `POST /auth/register` — Public. Creates user with `is_active: false`
- `POST /auth/login` — Public. Returns access + refresh tokens
- `POST /auth/refresh` — Exchange refresh token for new pair
- `POST /auth/logout` — Bearer required. Clears refresh token

### Registration Request/Response

```json
// POST /auth/register
// Request
{ "email": "user@example.com", "password": "pass123", "firstName": "John", "lastName": "Doe" }

// Response (201)
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "email": "user@example.com", "firstName": "John", "lastName": "Doe", "role": "USER" }
  }
}
```

### Login Request/Response

```json
// POST /auth/login
// Request
{ "email": "user@example.com", "password": "pass123" }

// Response (200) - Same format as register
```

### Token Refresh

```json
// POST /auth/refresh
// Request
{ "refreshToken": "eyJ..." }

// Response (200)
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

### Auth Flow
```
Register/Login → Get tokens → Use Bearer token → On expiry, refresh → Logout clears token
```

### Password Requirements
- Length: 6-50 characters
- Hashing: bcrypt (10 rounds)

---

## 3. User Management

**File:** `src/users/users.service.ts`

### User Schema (`users` table)

- `id` (UUID) — Primary key
- `email` (String) — Unique
- `password` (String) — Bcrypt hashed
- `first_name`, `last_name` (String, nullable)
- `role` (String) — ADMIN, USER, or VIEWER
- `is_active` (Boolean) — Default: false
- `refresh_token` (String, nullable)
- `created_at`, `updated_at` (DateTime)

### Roles

- **ADMIN** — Full access, can manage users, access all tables
- **USER** — Standard access, CRUD on non-admin tables
- **VIEWER** — Read-only access

### User Activation

New users created with `is_active: false`. Admin must activate:
- `POST /admin/users/:id/activate`
- `POST /admin/users/:id/deactivate`

### Endpoints

- `GET /users/me` — Current user profile (Bearer)
- `GET /users` — List users (ADMIN)
- `GET /users/:id` — Get user (ADMIN)
- `POST /users` — Create user (ADMIN)
- `PATCH /users/:id` — Update user (self or ADMIN)
- `DELETE /users/:id` — Delete user (ADMIN)

---

## 4. Database Tables

**File:** `prisma/schema.prisma`

### Core Tables

**users** — PK: `id` (UUID)
- Auth users with roles and tokens

**dental_groups** — PK: `dental_group_id` (BigInt)
- Dental group organizations
- Fields: name, address, city, state, zip, account_type, sales_channel

**dental_practices** — PK: `practice_id` (BigInt)
- Individual practices
- FK: `dental_group_id` → dental_groups, `fee_schedule` → fee_schedules

**labs** — PK: `lab_id` (BigInt, auto-increment)
- Lab partners
- Fields: lab_name, lab_sfdc_id, partner_model, is_active

**incisive_product_catalog** — PK: `incisive_id` (Int)
- Products with category, sub_category

**fee_schedules** — PK: `schedule_name` (String)

### Junction Tables

**lab_practice_mapping** — PK: `lab_practice_mapping_id`
- FK: lab_id → labs, practice_id → dental_practices
- Unique: (lab_id, lab_practice_id)

**lab_product_mapping** — PK: `lab_product_mapping_id`
- FK: lab_id → labs, incisive_product_id → incisive_product_catalog
- Unique: (lab_id, lab_product_id)

### Pricing Tables (Composite PKs)

**product_lab_markup** — PK: (lab_id, lab_product_id)
- Fields: cost, standard_price, nf_price, commitment_eligible

**product_lab_rev_share** — PK: (lab_id, lab_product_id, fee_schedule_name)
- Fields: revenue_share, commitment_eligible

### ETL Tables (Read-Only)

- `orders_current` — Current orders
- `orders_stage` — ETL staging
- `orders_history` — Audit log

---

## 5. API Endpoints

### Auth (`/auth`)

- `POST /auth/register` — Public
- `POST /auth/login` — Public
- `POST /auth/refresh` — Public (JwtRefreshGuard)
- `POST /auth/logout` — Bearer

### Admin (`/admin`) — All ADMIN only

- `GET /admin/dashboard` — User statistics
- `GET /admin/users` — List users (query: page, limit, search, role, isActive)
- `GET /admin/users/:id` — Get user
- `POST /admin/users` — Create user
- `PATCH /admin/users/:id` — Update user
- `DELETE /admin/users/:id` — Delete user
- `POST /admin/users/:id/activate` — Activate
- `POST /admin/users/:id/deactivate` — Deactivate

### Tables (`/tables`) — Bearer required

- `GET /tables` — List accessible tables
- `GET /tables/:table` — Table config (columns, permissions, PK)
- `GET /tables/:table/rows` — Get rows (query: page, limit, search, sortBy, sortOrder, filters)
- `GET /tables/:table/rows/:id` — Get row (supports JSON for composite PK)
- `POST /tables/:table/rows` — Create row (USER/ADMIN)
- `PATCH /tables/:table/rows/:id` — Update row (USER/ADMIN)
- `DELETE /tables/:table/rows/:id` — Delete row (USER/ADMIN)

**Special endpoints:**
- `PATCH /tables/product_lab_rev_share/rows` — Bulk upsert schedules
- `DELETE /tables/product_lab_rev_share/rows` — Delete all for lab/product
- `PATCH /tables/product_lab_markup/rows` — Update markup
- `DELETE /tables/product_lab_markup/rows` — Delete markup

### Lookups — Bearer required

- `GET /labs/ids` — Lab IDs + names
- `GET /practices/ids` — Practice IDs
- `GET /practices/search?query=` — Search (limit 15)
- `GET /products/ids` — Product IDs
- `GET /products/search?query=` — Search (limit 15)
- `GET /dental-groups/ids?search=` — Dental groups

### Health — Public

- `GET /health` — DB check (200/503)
- `GET /health/ping` — Liveness (always 200)

---

## 6. Permissions System

**File:** `src/auth/guards/roles.guard.ts`

### Auth Flow
```
Request → JwtAuthGuard (validates token) → RolesGuard (checks @Roles) → Controller
```

### Decorators

- `@Public()` — Skip auth
- `@Roles(Role.ADMIN)` — Require role
- `@CurrentUser()` — Extract user from request

### Table Permissions

**Allowed Tables:**
```
users, lab_product_mapping, lab_practice_mapping, incisive_product_catalog,
labs, dental_groups, dental_practices, fee_schedules, product_lab_markup, product_lab_rev_share
```

**Admin-Only:** `users`

**By Role:**
- ADMIN: full CRUD on all tables
- USER: full CRUD except admin-only tables
- VIEWER: read-only except admin-only tables

---

## 7. Dynamic Tables API

**File:** `src/tables/tables.service.ts`

### Table Config Response

```json
{
  "name": "labs",
  "label": "Labs",
  "columns": [
    { "key": "lab_id", "label": "Lab ID", "type": "number", "sortable": true, "editable": false }
  ],
  "permissions": { "read": true, "create": true, "update": true, "delete": true },
  "primaryKey": ["lab_id"],
  "hasCompositePrimaryKey": false
}
```

### Query Parameters

- `page` — Page number (default: 1)
- `limit` — Items per page (default: 10)
- `sortBy` — Column to sort
- `sortOrder` — asc/desc
- `search` — Search term
- `filters` — JSON string: `{"is_active":true}`

### Rows Response

```json
{
  "data": [{ "lab_id": 1, "lab_name": "Lab A" }],
  "meta": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
}
```

### Composite Primary Keys

Use JSON in URL: `GET /tables/product_lab_markup/rows/{"lab_id":1,"lab_product_id":"PROD-001"}`

---

## 8. Error Handling

**File:** `src/common/filters/http-exception.filter.ts`

### Response Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description",
  "errors": null,
  "timestamp": "2025-02-06T12:00:00.000Z",
  "path": "/api/v1/endpoint"
}
```

### Error Codes

- **400** — Validation error, FK constraint, check constraint
- **401** — Invalid/expired token, inactive account
- **403** — Insufficient permissions
- **404** — Resource not found
- **409** — Duplicate (unique constraint)
- **500** — Server error

### Prisma Errors

- `P2002` → 409 Conflict
- `P2003` → 400 Bad Request
- `P2025` → 404 Not Found

---

## 9. Environment Variables

**File:** `.env.example`

### Required

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
JWT_ACCESS_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret
```

### Optional

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
JWT_ACCESS_EXPIRATION=1d
JWT_REFRESH_EXPIRATION=7d
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

### URL Encoding

Special chars in password: `@` → `%40`, `#` → `%23`

---

## 10. File Reference

### Controllers
- `src/auth/auth.controller.ts`
- `src/users/users.controller.ts`
- `src/admin/admin.controller.ts`
- `src/tables/tables.controller.ts`
- `src/labs/labs.controller.ts`
- `src/practices/practices.controller.ts`
- `src/products/products.controller.ts`
- `src/dental-groups/dental-groups.controller.ts`
- `src/health/health.controller.ts`

### Services
- `src/auth/auth.service.ts`
- `src/users/users.service.ts`
- `src/admin/admin.service.ts`
- `src/tables/tables.service.ts`
- `src/prisma/prisma.service.ts`

### Guards & Strategies
- `src/auth/guards/jwt-auth.guard.ts` — Global JWT validation
- `src/auth/guards/roles.guard.ts` — Role-based access
- `src/auth/strategies/jwt.strategy.ts` — Access token
- `src/auth/strategies/jwt-refresh.strategy.ts` — Refresh token

### Middleware
- `src/common/filters/http-exception.filter.ts` — Error handler
- `src/common/interceptors/logging.interceptor.ts` — Request logging
- `src/common/interceptors/transform.interceptor.ts` — Response wrapping

### Decorators
- `src/auth/decorators/public.decorator.ts`
- `src/auth/decorators/roles.decorator.ts`
- `src/common/decorators/current-user.decorator.ts`

### Config
- `src/config/app.config.ts`
- `src/config/database.config.ts`
- `src/config/jwt.config.ts`

### Schema
- `prisma/schema.prisma`
- `src/tables/tables.enum.ts`

---

## 11. Quick Reference

### Standard Response Wrapper

```json
{ "success": true, "data": {...}, "timestamp": "ISO8601" }
```

### Auth Header

```
Authorization: Bearer eyJ...
```

### Swagger UI

```
http://localhost:3000/api/docs
```

### Prisma Commands (Safe)

```bash
npx prisma db pull      # Sync schema from DB
npx prisma generate     # Generate client
npx prisma studio       # GUI viewer
```

### Prisma Commands (NEVER use)

```bash
npx prisma migrate dev/deploy/reset
npx prisma db push
```

### Build & Run

```bash
npm run start:dev       # Dev with watch
npm run build           # Compile
npm run start:prod      # Production
```

---

*Document generated: February 2026*
