# B.M.D STUDIO MANAGEMENT SYSTEM — MASTER PLAN

> Source of truth for architecture and delivery sequence.
> Status legend: `PLANNED` · `IN PROGRESS` · `IMPLEMENTED` · `TESTED` · `PRODUCTION READY`
> Last updated: 2026-09-14 (sign-in, registration and the customer account area implemented and tested)

---

## 0. PROJECT AUDIT (Phase 0)

### 0.1 Existing structure

The repository was empty at audit time:

```
BMD-Studio/
├── .git/
└── README.md      # single line: "# BMD-Studio"
```

- No `plan.md` existed prior to this document.
- No source code, no `package.json`, no Prisma schema, no migrations, no routes,
  no components, no authentication, no tests, no CI, no environment files.
- Single commit: `570ec26 Initial commit`, branch `main`, clean tree.

### 0.2 Existing technology

None installed in-repo. Host toolchain verified:

| Tool   | Version  | Use                                    |
| ------ | -------- | -------------------------------------- |
| Node   | v24.15.0 | runtime for client + server            |
| npm    | 11.12.1  | package manager / workspaces           |
| pnpm   | 10.28.2  | available, not used                    |
| Docker | 29.4.0   | PostgreSQL, Redis, MinIO for local dev |
| psql   | absent   | use `docker compose exec db psql`      |

### 0.3 Existing features

None. Nothing works because nothing exists.

### 0.4 Missing features

Everything in the brief. Tracked in §7 Development Phases.

### 0.5 Architecture assessment

Nothing to retain, nothing to refactor, no legacy constraints. Greenfield.
This removes the "do not rewrite an existing project" risk entirely and lets us
choose the correct architecture from the start.

### 0.6 Database assessment

No database, no schema, no migrations. Full schema to be designed (§4).

### 0.7 Security assessment

No controls exist. Every control in §6 must be built from scratch.

### 0.8 Resolved contradiction — JavaScript vs TypeScript

The brief states "Use JavaScript, NOT TypeScript ... unless explicitly
instructed", and its closing stack section explicitly specifies TypeScript for
frontend, backend and API. The explicit, later instruction governs.

**Decision: TypeScript across client, server and shared packages.**
Rationale: booking, pricing and payment correctness benefit materially from
compile-time guarantees, and a shared package lets one Zod schema define both
runtime validation and static types for both sides of the wire.

### 0.9 Technical risks

| #   | Risk                                                 | Impact                                                                  | Mitigation                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Double booking under concurrency                     | Business-critical: two customers, one room                              | Postgres `tstzrange` + GiST `EXCLUDE` constraint (database-enforced, not app-enforced) plus transactional insert. Verified with parallel requests (§8).                                                                                                                                    |
| R2  | M-Pesa Daraja credentials unavailable during build   | Payments cannot be exercised end to end                                 | Provider hidden behind a `PaymentProvider` interface; a mock driver exists only when `PAYMENTS_DRIVER=mock` and is refused in production config. Real STK push and callback verification are implemented and documented. Payment status is only ever set from a backend-verified callback. |
| R3  | M-Pesa callbacks require a public HTTPS URL          | Callbacks cannot reach localhost                                        | Document a tunnel (cloudflared/ngrok) for development; callback URL comes from env.                                                                                                                                                                                                        |
| R4  | Duplicate or replayed payment callbacks              | Double-crediting a booking                                              | Idempotency on the provider transaction id (unique index) plus a status state machine that forbids illegal transitions.                                                                                                                                                                    |
| R5  | Streaming provider APIs need OAuth apps and review   | Live integration cannot be fully exercised without approved credentials | `StreamProvider` interface with real YouTube Data API v3 and Graph API adapters; the feature reports itself unconfigured when credentials are absent. No fake stream state, ever.                                                                                                          |
| R6  | Object storage credentials                           | Media uploads blocked                                                   | S3-compatible abstraction; MinIO in docker-compose for development, R2/S3 in production.                                                                                                                                                                                                   |
| R7  | Timezone correctness (Africa/Nairobi, UTC+3, no DST) | Wrong slots, wrong ON-AIR state                                         | Store all timestamps as `timestamptz` in UTC, convert only at the edges, single `TIMEZONE` env (`Africa/Nairobi`).                                                                                                                                                                         |
| R8  | Recurring show schedules expanding to occurrences    | "What is live now" answers wrongly                                      | Materialise `show_occurrences` rows from recurrence rules via a scheduled job rather than computing recurrence inside queries.                                                                                                                                                             |
| R9  | Scope size                                           | A project that never finishes                                           | Strict phase gating with a Definition of Done per phase (§9).                                                                                                                                                                                                                              |

---

## 1. SYSTEM ARCHITECTURE

```
                    ┌────────────────────────────────────────────┐
  Browser  ───────► │ client/  React + TS + Vite + Tailwind       │
  (public + staff)  │ React Router · TanStack Query · Axios       │
                    └───────────────┬────────────────────────────┘
                                    │ HTTPS  JSON REST  /api/v1
                                    │ access token (memory) +
                                    │ refresh cookie (httpOnly)
                    ┌───────────────▼────────────────────────────┐
                    │ server/  Node + Express + TS                │
                    │  routes → controllers → services →          │
                    │  repositories → Prisma → PostgreSQL         │
                    │  middleware: auth, RBAC, zod validation,    │
                    │  rate limit, helmet, error handler, audit   │
                    │  jobs: occurrence expansion, reminders,     │
                    │        notification dispatch, stream poll   │
                    └──┬──────────┬──────────┬─────────┬──────────┘
                       │          │          │         │
              ┌────────▼──┐  ┌────▼─────┐ ┌──▼──────┐ ┌▼─────────────┐
              │PostgreSQL │  │ Object   │ │ M-Pesa  │ │ YouTube /    │
              │ + Prisma  │  │ storage  │ │ Daraja  │ │ Facebook     │
              │ (source of│  │ (S3/R2/  │ │ Stripe  │ │ Live APIs    │
              │  truth)   │  │  MinIO)  │ │         │ │              │
              └───────────┘  └──────────┘ └─────────┘ └──────────────┘
                                              ▲
                                              │ webhooks / callbacks
                                              │ (verified server-side)
```

The physical broadcast path sits outside the application; the application
manages and records it:

```
Studio desk → encoder (OBS/hardware) → RTMP ingest at provider
   → YouTube/Facebook → public live page (embedded player) → audience
```

The application never proxies video. It manages stream metadata, schedules,
ON-AIR state and public presentation, and reads statistics from provider APIs.

### 1.1 Repository layout (npm workspaces monorepo)

```
BMD-Studio/
├── package.json                 # workspaces root, orchestration scripts
├── docker-compose.yml           # postgres, redis, minio (dev)
├── plan.md · README.md · docs/
├── packages/shared/             # Zod schemas, DTO types, enums, constants
├── server/
│   ├── prisma/{schema.prisma,migrations/,seed.ts}
│   ├── src/{config,middleware,routes,controllers,services,repositories,
│   │        validators,integrations,jobs,lib,utils,types}
│   └── tests/{unit,integration}
└── client/
    └── src/{app,components,layouts,pages,routes,features,hooks,
              services,context,lib,styles,assets}
```

`features/` holds vertical slices (bookings, equipment, shows, streaming,
payments and so on), each with its own components, hooks and API module.
`components/` holds the shared design system only.

---

## 2. MODULE MAP

| Module              | Public               | Customer                         | Staff / Admin                                |
| ------------------- | -------------------- | -------------------------------- | -------------------------------------------- |
| Auth & accounts     | register / login     | profile, password                | user & role administration                   |
| Studios & rooms     | browse               | select for booking               | CRUD, hours, blackouts, maintenance          |
| Services & pricing  | browse               | select                           | CRUD, categories, pricing rules              |
| Availability        | view slots           | view slots                       | overrides, blackout periods                  |
| Bookings            | —                    | create, view, cancel, reschedule | approve, reassign, calendar, conflicts       |
| Equipment           | browse catalogue     | rent, return                     | inventory, condition, maintenance, approvals |
| Shows & schedule    | schedule page        | —                                | CRUD shows, presenters, recurrence           |
| ON AIR              | live indicator       | live indicator                   | control panel, force on/off air              |
| Streaming           | live page, player    | watch, share                     | create/start/stop stream, platforms, stats   |
| Photography & media | portfolio, galleries | book packages, view deliverables | upload, galleries, deliverables              |
| Payments            | —                    | pay (M-Pesa/card), receipts      | reconcile, refunds, ledger                   |
| Notifications       | —                    | preferences, inbox               | broadcast, templates                         |
| Reports             | —                    | —                                | revenue, utilisation, equipment, bookings    |
| Administration      | —                    | —                                | settings, audit log, roles and permissions   |

---

## 3. AUTHORIZATION PLAN

### 3.1 Roles

`SUPER_ADMIN`, `STUDIO_ADMIN`, `STUDIO_MANAGER`, `PRODUCER`, `PRESENTER`,
`TECHNICIAN`, `MEDIA_STAFF`, `FINANCE`, `CUSTOMER`.

Roles are database rows, not a hard-coded enum in business logic, with a
permissions join, so permissions are adjustable without a deploy. The seed
defines the baseline.

### 3.2 Permission strings

`<resource>:<action>[:scope]`, where scope is `own` or `any`.
Examples: `booking:read:own`, `booking:read:any`, `booking:cancel:any`,
`equipment:write`, `payment:refund`, `stream:control`, `user:role:assign`,
`settings:write`, `audit:read`.

### 3.3 Baseline matrix (abridged; full matrix in `docs/SECURITY.md`)

| Permission group              | SUPER | S.ADMIN | MANAGER | PRODUCER | PRESENTER | TECH | MEDIA | FINANCE | CUSTOMER     |
| ----------------------------- | ----- | ------- | ------- | -------- | --------- | ---- | ----- | ------- | ------------ |
| users / roles administration  | yes   | partial | —       | —        | —         | —    | —     | —       | —            |
| studios / services CRUD       | yes   | yes     | yes     | —        | —         | —    | —     | —       | —            |
| bookings read any             | yes   | yes     | yes     | yes      | own shows | yes  | yes   | yes     | own only     |
| bookings approve / cancel any | yes   | yes     | yes     | —        | —         | —    | —     | —       | own only     |
| equipment CRUD                | yes   | yes     | yes     | —        | —         | yes  | —     | —       | —            |
| equipment rental approve      | yes   | yes     | yes     | —        | —         | yes  | —     | —       | —            |
| shows CRUD                    | yes   | yes     | yes     | yes      | —         | —    | —     | —       | —            |
| stream control                | yes   | yes     | yes     | yes      | —         | yes  | —     | —       | —            |
| media upload / galleries      | yes   | yes     | yes     | yes      | —         | —    | yes   | —       | —            |
| payments read / refund        | yes   | yes     | read    | —        | —         | —    | —     | yes     | own receipts |
| settings / audit              | yes   | yes     | —       | —        | —         | —    | —     | —       | —            |

Enforcement is **server-side**, in `requirePermission()` middleware plus
service-level ownership checks. The client hides UI it cannot use, but that is
cosmetic only: every route is independently authorised on the API.

### 3.4 Token strategy

- Access token: JWT, 15 minutes, `Authorization: Bearer`, held in memory rather
  than localStorage, carrying `sub`, `roles`, `permissions`, `jti`.
- Refresh token: opaque 256-bit random value, stored SHA-256 hashed in
  `sessions`, delivered as an `httpOnly; Secure; SameSite=Strict` cookie, 30
  days, **rotated** on every use; reuse of a rotated token revokes the whole
  session family.
- Password hashing: argon2id.
- Logout revokes the session row; a user whose `status` is not `ACTIVE` cannot
  refresh.

---

## 4. DATABASE PLAN (PostgreSQL + Prisma)

All timestamps are `timestamptz` in UTC. Money is stored as integer **cents of
KES** (`Int`), never as a float. Every table carries `id` (cuid), `created_at`
and `updated_at`.

### 4.1 Entities

**Identity** — `users` (email, phone E.164 `+254…`, password_hash, status,
name, avatar_media_id) · `roles` · `permissions` · `role_permissions` ·
`user_roles` · `sessions` (refresh hash, user agent, ip, expires_at,
revoked_at) · `password_reset_tokens` · `email_verification_tokens`.

**Studio** — `studios` (branch, location, timezone) · `studio_rooms` (capacity,
hourly_rate_cents, status) · `service_categories` · `services` (pricing model
`HOURLY | SESSION | PACKAGE`, base_price_cents, min/max duration,
buffer_minutes, requires_approval) · `room_services` (which rooms deliver which
services) · `operating_hours` (studio, weekday, open, close) ·
`blackout_periods` (studio or room, range, reason `HOLIDAY | MAINTENANCE |
PRIVATE`).

**Booking** — `bookings` (customer_id, studio_id, room_id, service_id, a
generated `period tstzrange`, status, subtotal / discount / tax / total cents,
notes, approved_by, cancelled_at, cancellation_reason) · `booking_items` (line
items: service, equipment, addon; quantity, unit_price_cents) ·
`booking_status_history` (from, to, actor, reason, at).

Statuses: `PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`, plus
`PENDING_APPROVAL`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED`.

**Equipment** — `equipment_categories` · `equipment` (name, unique serial_no,
unique asset_tag, condition, status, daily_rate_cents, deposit_cents, location,
image_media_id) · `equipment_rentals` (customer, `period tstzrange`, status,
total cents, nullable booking_id) · `equipment_rental_items` (equipment_id,
quantity, condition_out, condition_in, damage_notes, late_fee_cents) ·
`equipment_maintenance` (opened, closed, cost, notes).

**Shows and broadcast** — `shows` (name, slug, description, category, cover) ·
`show_hosts` (user_id, role `PRESENTER | CO_HOST | PRODUCER`) ·
`show_schedules` (recurrence rule: weekdays, start_time, end_time, valid_from,
valid_to, room_id) · `show_occurrences` (materialised concrete `period
tstzrange`, status `SCHEDULED | LIVE | ENDED | CANCELLED`). The occurrences
table answers "what is live now" and "what is next" with one indexed query.

**Streaming** — `streams` (optional occurrence_id, title, description,
thumbnail, status `IDLE | SCHEDULED | LIVE | ENDED | ERROR`, scheduled_for,
started_at, ended_at) · `stream_platforms` (stream_id, platform `YOUTUBE |
FACEBOOK | CUSTOM_RTMP`, external_id, watch_url, embed_url, status) ·
`stream_stats` (time series: platform_id, at, concurrent_viewers, total_views,
likes), populated by a polling job from provider APIs and never invented.

**Media** — `media_files` (storage_key, bucket, mime, size, width, height,
duration, checksum, uploaded_by, visibility `PUBLIC | PRIVATE`, variants JSON) ·
`galleries` (title, slug, type `PHOTO | VIDEO | PORTFOLIO`, cover, published) ·
`gallery_items` (gallery_id, media_id, position, caption). Binary bytes live in
object storage; only metadata is in Postgres.

**Photography** — modelled as `services` under a photography category, plus
`photography_packages` (deliverables count, edit turnaround days, price_cents)
and `booking_deliverables` (booking_id, gallery_id, delivered_at).

**Payments** — `payments` (optional booking_id or rental_id, customer_id,
amount_cents, currency KES, provider `MPESA | STRIPE | CASH | BANK`, purpose,
status `PENDING | PROCESSING | SUCCESSFUL | FAILED | CANCELLED | REFUNDED`,
unique idempotency_key) · `payment_transactions` (append-only event ledger:
payment_id, provider_ref, kind `INITIATE | CALLBACK | QUERY | REFUND`, raw
payload JSONB, result_code, result_desc, received_at, signature_verified) ·
`refunds` (payment_id, amount_cents, reason, status, provider_ref). Payments are
independent of bookings and are never mutated by client input.

**Notifications** — `notifications` (user_id, type, title, body, data JSONB,
read_at) · `notification_preferences` (user_id, channel, category, enabled) ·
`notification_outbox` (channel `EMAIL | SMS | WHATSAPP | PUSH | IN_APP`,
recipient, template, payload, status `QUEUED | SENT | FAILED`, attempts,
last_error, send_after). The outbox makes delivery retryable and auditable.

**Administration** — `audit_logs` (actor_id, actor_ip, action, entity_type,
entity_id, before JSONB, after JSONB, at) · `settings` (key, value JSONB,
updated_by) · `jobs` (name, last_run_at, status) for the scheduler.

### 4.2 Double-booking prevention (R1) — the critical constraint

Prisma cannot express exclusion constraints, so the hand-written migration
`20260910094600_exclusion_constraints` adds them:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    room_id                                    WITH =,
    tstzrange(starts_at, ends_at, '[)')        WITH &&
  ) WHERE (status IN ('PENDING_PAYMENT','PENDING_APPROVAL','CONFIRMED','IN_PROGRESS'));
```

**Implementation note — expression instead of a generated column.** The plan
originally specified a stored generated `period` column. The shipped version
uses the `tstzrange(...)` expression directly. The guarantee is identical, and
it keeps the physical schema free of columns Prisma does not model, so
`prisma migrate dev` never proposes dropping them. This was verified: a
`--create-only` diff against the live schema produces an empty migration.

An overlapping insert fails at the database no matter how many application
servers are running. Equivalent constraints guard `equipment_rental_items` (per
equipment unit) and `show_occurrences` (per room, only when a room is set).

Because an exclusion predicate cannot join, `equipment_rental_items` carries a
denormalised `rental_status` mirroring its parent. Two triggers keep it
truthful — one inherits the parent's status on insert, one propagates a change
on update — so the mirror is maintained by the database, not trusted to
application code.

The migration also adds `CHECK` constraints that reject inverted and
zero-length periods and non-positive payment amounts, so a bad range fails as a
clear `23514` rather than as an obscure error inside the exclusion operator.

The service layer catches SQLSTATE `23P01` and returns `409 SLOT_UNAVAILABLE`;
`server/src/lib/prisma.ts` extracts the SQLSTATE (Prisma reports exclusion and
check violations as `PrismaClientUnknownRequestError`, with the code only in the
message text). Booking creation runs inside a transaction that re-validates
operating hours, blackouts and service/room compatibility, and **recomputes the
price server-side** before the insert.

### 4.3 Indexing

`bookings(room_id, starts_at)`, the GiST index created by each exclusion
constraint, `bookings(customer_id, starts_at desc)`, `show_occurrences(starts_at)`
with a partial index on `LIVE`, `payments(status, created_at)`, unique
`payment_transactions(provider, provider_ref)`,
`equipment(status, category_id)`, `audit_logs(entity_type, entity_id, at desc)`,
`notifications(user_id, read_at)`, plus GiST range indexes on
`blackout_periods` and `equipment_maintenance` for the availability engine.

### 4.4 Phase 2 delivery notes

| Decision             | Shipped as                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Times of day         | `Int` minutes from midnight (0–1440) on `operating_hours` and `show_schedules`, not SQL `time`. A wall-clock time has no instant attached; an integer keeps comparison exact.  |
| Weekday numbering    | `0 = Sunday … 6 = Saturday`, matching JavaScript's `Date#getDay`.                                                                                                              |
| Prisma configuration | `server/prisma.config.ts`. The `package.json#prisma` key is deprecated and removed in Prisma 7.                                                                                |
| Seeded admin         | Created only when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set. There is no default password in any environment, and a re-run never resets an existing password.       |
| Seed idempotency     | Every write is an upsert on a natural key; role grants are replaced rather than merged, so a revoked permission is actually revoked. Verified by re-running: counts unchanged. |
| Test database        | A second Postgres container on port 5433. The suite refuses to start when `TEST_DATABASE_URL` equals `DATABASE_URL`, because it truncates between tests.                       |

Files: `server/prisma/schema.prisma` (44 models, 23 enums),
`server/prisma/migrations/…_init`, `…_exclusion_constraints`,
`server/prisma/seed.ts`, `server/src/lib/prisma.ts`,
`server/tests/integration/overlap-constraints.test.ts`.

---

## 5. API PLAN

Base path `/api/v1`. Every response uses one envelope:

```jsonc
// success
{ "success": true, "data": {}, "meta": { "page": 1, "pageSize": 20, "total": 97 } }
// failure
{ "success": false, "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "details": [] },
  "requestId": "01J..." }
```

Conventions: page-based pagination (`?page&pageSize`), `?sort=-createdAt`,
resource-specific filters, an `Idempotency-Key` header on payment initiation,
and a `requestId` on every response and log line.

| Resource                 | Endpoints (abridged)                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                  | `POST register, login, refresh, logout, forgot-password, reset-password, verify-email`; `GET me`                                                         |
| `/users`                 | `GET /` (admin), `GET/PATCH /:id`, `PATCH /:id/status`, `POST /:id/roles`                                                                                |
| `/roles`, `/permissions` | `GET /`, `POST/PATCH/DELETE /:id`, role-to-permission assignment                                                                                         |
| `/studios`               | CRUD, `GET /:id/rooms`, `/:id/operating-hours`, `/:id/blackouts`                                                                                         |
| `/services`              | CRUD plus `/categories`                                                                                                                                  |
| `/availability`          | `GET ?roomId&serviceId&date` returning real computed slots (hours − blackouts − bookings − maintenance − buffers)                                        |
| `/bookings`              | `POST /` (validate, price, create), `GET /` (scoped), `GET /:id`, `PATCH /:id` (reschedule), `POST /:id/cancel`, `POST /:id/approve`, `GET /calendar`    |
| `/equipment`             | CRUD, `/categories`, `GET /:id/availability`, `POST /:id/maintenance`                                                                                    |
| `/equipment-rentals`     | `POST /`, `GET /`, `POST /:id/approve                                                                                                                    | reject                                        | checkout | return` |
| `/shows`                 | CRUD, `/:id/hosts`, `/:id/schedules`, `GET /schedule?from&to`                                                                                            |
| `/on-air`                | `GET /` returning `{ current, next }` computed from occurrences; `POST /:occurrenceId/start                                                              | end` (permissioned)                           |
| `/streams`               | CRUD, `POST /:id/start                                                                                                                                   | stop`, `GET /:id/stats`, `GET /live` (public) |
| `/media`                 | `POST /uploads/presign`, `POST /`, `GET /:id`, `DELETE /:id`, `/galleries` CRUD                                                                          |
| `/payments`              | `POST /mpesa/stkpush`, `POST /mpesa/callback` (public, verified), `POST /stripe/intent`, `POST /stripe/webhook`, `GET /`, `GET /:id`, `POST /:id/refund` |
| `/notifications`         | `GET /`, `POST /:id/read`, `GET/PATCH /preferences`                                                                                                      |
| `/admin`                 | `GET /dashboard`, `/reports/*`, `/audit-logs`, `/settings`                                                                                               |
| `/health`                | `GET /health` (liveness), `/health/ready` (database and storage)                                                                                         |

Public and unauthenticated: the services catalogue, shows schedule, `on-air`,
`streams/live`, published galleries, availability lookup and payment callbacks.

---

## 6. SECURITY PLAN

argon2id password hashing · JWT with rotating refresh tokens and reuse
detection · RBAC middleware on every non-public route · Zod validation of body,
query and params · parameterised Prisma queries, with raw SQL confined to
reviewed migrations · helmet with a content security policy · a CORS allowlist
from env · rate limiting globally and strictly on auth and payment endpoints ·
`httpOnly`, `Secure`, `SameSite` cookies · CSRF: the refresh cookie is
`SameSite=Strict` and state-changing calls require the Bearer token, so a
cookie-only forgery cannot authenticate · upload validation by magic-byte
sniffing plus extension, MIME and size checks, with presigned direct-to-bucket
uploads and no executable types · webhook verification (Stripe signature;
M-Pesa source-IP allowlist plus a confirmation query back to Daraja before a
callback is trusted) · secrets only in environment variables, with
`.env.example` documenting every key and holding no real values · audit logging
of all privileged mutations · no stack traces to clients, with structured pino
logs server-side that redact tokens, passwords and payment payloads.

---

## 7. DEVELOPMENT PHASES AND DEPENDENCIES

```
P0 audit/plan ─► P1 foundation ─► P2 database ─► P3 auth+RBAC ─┬─► P4 studio/services ─► P5 booking ─┬─► P10 payments ─► P11 notifications
                                                               ├─► P6 equipment ────────────────────┘
                                                               ├─► P7 shows/schedule ─► P8 streaming/ON AIR
                                                               └─► P9 photography/media

P12 customer portal ◄── P5, P6, P9, P10
P13 admin dashboard ◄── P4..P11
P14 reports ◄── P13      P15 hardening ◄── all      P16 QA ◄── all      P17 deploy ◄── P16
```

| Phase   | Deliverable                                                                                                                                                                                                                                      | Depends on      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| **P0**  | Audit and this plan                                                                                                                                                                                                                              | —               |
| **P1**  | Monorepo and workspaces, TS configs, lint and format, Vite + Tailwind client shell, Express server skeleton, error/response/logging middleware, docker-compose (db, redis, minio), `.env.example`, health endpoints, Vitest harness, CI workflow | P0              |
| **P2**  | Full Prisma schema, initial migration, hand-written exclusion-constraint migration, seed (roles, permissions, admin, studio, rooms, services, equipment, shows)                                                                                  | P1              |
| **P3**  | Auth endpoints, argon2, sessions and refresh rotation, RBAC middleware, client auth context, protected routes, login and register UI                                                                                                             | P2              |
| **P4**  | Studios, rooms, categories, services, operating hours, blackouts — API plus admin CRUD UI                                                                                                                                                        | P3              |
| **P5**  | Availability engine, booking engine, conflict prevention, pricing service, cancel and reschedule, booking UI flow, concurrency tests                                                                                                             | P4              |
| **P6**  | Equipment inventory, availability, rental lifecycle, maintenance, admin and customer UI                                                                                                                                                          | P4              |
| **P7**  | Shows, hosts, recurrence rules, occurrence expansion job, public schedule page                                                                                                                                                                   | P4              |
| **P8**  | Stream provider abstraction, YouTube and Facebook adapters, ON-AIR service and control panel, public live page, statistics polling                                                                                                               | P7              |
| **P9**  | Object storage, presigned uploads, media library, galleries, portfolio, photography packages and deliverables                                                                                                                                    | P4              |
| **P10** | Payment domain, M-Pesa STK push and verified callback, Stripe, refunds, booking and rental settlement, receipts                                                                                                                                  | P5, P6          |
| **P11** | Notification outbox, channel adapters, templates, preferences, in-app inbox, reminder jobs                                                                                                                                                       | P10             |
| **P12** | Customer portal: my bookings, my rentals, payments, deliverables, profile                                                                                                                                                                        | P5, P6, P9, P10 |
| **P13** | Operational dashboard: today, ON AIR, pending items, alerts, activity                                                                                                                                                                            | P4–P11          |
| **P14** | Reports and analytics: revenue, utilisation, equipment, customers, exports                                                                                                                                                                       | P13             |
| **P15** | Security hardening pass, rate limits, headers, dependency audit, penetration-test checklist                                                                                                                                                      | all             |
| **P16** | Test coverage completion, end-to-end happy paths, load check on booking                                                                                                                                                                          | all             |
| **P17** | Dockerfiles, migrations on deploy, environments, backups, runbook                                                                                                                                                                                | P16             |

---

## 8. TESTING PLAN

Runner: **Vitest** on both sides. API integration tests use **supertest**
against a real Postgres (the docker-compose test database, migrated and
truncated per suite) — the database is not mocked, because the constraints _are_
the feature. Client tests use React Testing Library with MSW.

| Area         | Tests                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | register (valid, duplicate, weak password), login success/invalid/locked, refresh rotation, refresh-reuse revocation, protected route without or with expired token, logout invalidation                                                                                           |
| RBAC         | each role against a representative endpoint matrix; customer hitting an admin route returns 403; ownership scoping, so `:own` cannot read another customer's booking                                                                                                               |
| Availability | slots respect operating hours, blackouts, buffers, existing bookings and maintenance                                                                                                                                                                                               |
| Booking      | create valid; reject outside hours; reject during blackout; **reject overlapping**; **N parallel identical requests yield exactly one success and N−1 conflicts**; cancellation policy; reschedule re-validates; price computed server-side and client-supplied totals ignored     |
| Equipment    | availability window, rental create/approve/checkout/return, damaged and maintenance items not rentable, overlapping rental of the same unit rejected                                                                                                                               |
| Shows        | recurrence expansion across week boundaries in EAT; on-air current and next resolution at boundary instants                                                                                                                                                                        |
| Streaming    | provider adapter contract tests with mocked HTTP; status transitions; an unconfigured provider reports unavailable rather than fake-live                                                                                                                                           |
| Media        | upload validation (type, size, magic bytes), presign authorisation, private media not publicly readable                                                                                                                                                                            |
| Payments     | initiation creates PENDING with idempotency; successful callback moves payment to SUCCESSFUL and booking to CONFIRMED; failed callback; **invalid or unsigned webhook rejected**; **duplicate callback is a no-op**; refund path; a frontend claim of success never mutates status |
| Admin        | dashboard aggregates, audit log written on privileged mutations, settings authorisation                                                                                                                                                                                            |

CI runs typecheck, lint, unit tests, integration tests (with a Postgres
service), then build.

---

## 9. DEFINITION OF DONE (per feature)

UI, API, schema, validation, authorization, error handling, loading and empty
states, wired integration, tests, updated documentation, green build. Anything
short of that is reported as `IN PROGRESS`, never as implemented.

---

## 10. DEPLOYMENT PLAN

- **Database**: managed Postgres (Neon, Railway or Render) with point-in-time
  backups; releases run `prisma migrate deploy`, never `db push`.
- **Server**: multi-stage non-root Docker image on Render, Fly or a VPS behind
  HTTPS; environment from the platform secret store; `/health/ready` as probe.
- **Client**: static build on Netlify, Vercel or Cloudflare Pages;
  `VITE_API_URL` per environment; SPA rewrites.
- **Storage**: Cloudflare R2 or S3, private by default, presigned reads.
- **Jobs**: in-process scheduler through P7–P11, extractable to a worker later.
- **Environments**: `development` (docker-compose), `staging`, `production`.
- **Runbook**: `docs/DEPLOYMENT.md` covering migrations, rollback, secret
  rotation, M-Pesa callback URL registration and a backup restore drill.

---

## 11. PHASE STATUS TRACKER

| Phase                       | Status      |
| --------------------------- | ----------- |
| P0 Audit and plan           | IMPLEMENTED |
| P1 Foundation               | IMPLEMENTED |
| P2 Database                 | TESTED      |
| P3 Auth and RBAC            | IN PROGRESS |
| P4 Studio and services      | IN PROGRESS |
| P5 Booking and availability | PLANNED     |
| P6 Equipment                | IN PROGRESS |
| P7 Shows and scheduling     | IN PROGRESS |
| P8 Streaming and ON AIR     | IN PROGRESS |
| P9 Photography and media    | IN PROGRESS |
| P10 Payments                | PLANNED     |
| P11 Notifications           | PLANNED     |
| P12 Customer portal         | IN PROGRESS |
| P13 Admin dashboard         | PLANNED     |
| P14 Reports                 | PLANNED     |
| P15 Security hardening      | PLANNED     |
| P16 Testing and QA          | PLANNED     |
| P17 Deployment              | PLANNED     |
