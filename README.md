# B.M.D Studio Management System

Operational platform for a Kenyan radio, broadcasting, podcast, photography and
livestream production studio: studio and service configuration, bookings,
equipment hire, show scheduling, ON-AIR state, livestreaming, media delivery,
M-Pesa payments, notifications and reporting.

**This is a real application under phased construction.** The delivery plan,
architecture and phase status live in [`plan.md`](plan.md). Anything not marked
implemented there is not implemented.

---

## Current status

| Phase                | Status                                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| P0 Audit and plan    | **Implemented** — [`plan.md`](plan.md)                                     |
| P1 Foundation        | **Implemented** — monorepo, API skeleton, client shell, tooling, tests, CI |
| P2 Database (Prisma) | Planned — next                                                             |
| P3 – P17             | Planned — see [`plan.md`](plan.md) §7                                      |

What actually works today: the API boots, serves `/api/v1/health` and
`/api/v1/health/ready` behind hardened headers, rate limiting, request
correlation ids and a central error handler; the web client builds, routes, and
renders a real connection panel driven by the live API. There is no database, no
authentication and no booking engine yet — the routes for those modules show an
honest placeholder naming the phase that delivers them.

---

## Stack

| Layer       | Technology                                                                |
| ----------- | ------------------------------------------------------------------------- |
| Client      | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| Server      | Node.js, Express 5, TypeScript, Zod, Pino                                 |
| Database    | PostgreSQL 16 + Prisma (Phase 2)                                          |
| Shared      | `@bmd/shared` — types, RBAC vocabulary, money and Kenyan phone helpers    |
| Testing     | Vitest, Supertest, React Testing Library                                  |
| Local infra | Docker Compose — PostgreSQL, Redis, MinIO                                 |

---

## Repository layout

```
BMD-Studio/
├── packages/shared/   # types, RBAC constants, money + phone utilities
├── server/            # Express API (routes → controllers → services → repositories)
├── client/            # React web application
├── docker-compose.yml # postgres, postgres-test, redis, minio
├── plan.md            # architecture and phase plan — source of truth
└── .github/workflows/ # CI: typecheck, lint, format, test, build, audit
```

---

## Getting started

Requires **Node 20.11+** and **Docker**.

```bash
# 1. install workspace dependencies
npm install

# 2. create environment files (never commit the filled-in copies)
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. start local infrastructure (PostgreSQL, Redis, MinIO)
npm run db:up

# 4. build the shared package (server and client import it)
npm run build --workspace=@bmd/shared

# 5. run the API and the web client
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so browser requests stay
same-origin and cookies behave exactly as they do in production.

Verify the API:

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/ready
```

---

## Scripts

| Command              | Purpose                                 |
| -------------------- | --------------------------------------- |
| `npm run dev:server` | API in watch mode                       |
| `npm run dev:client` | Web client in watch mode                |
| `npm run build`      | Build shared package, server and client |
| `npm run typecheck`  | TypeScript across all workspaces        |
| `npm run lint`       | ESLint across the repository            |
| `npm run format`     | Prettier write                          |
| `npm test`           | Vitest across all workspaces            |
| `npm run db:up`      | Start PostgreSQL, Redis and MinIO       |
| `npm run db:psql`    | Open psql inside the database container |

---

## Configuration

Every variable the system reads is documented in
[`server/.env.example`](server/.env.example) and
[`client/.env.example`](client/.env.example), grouped by the phase that
introduces it. No secret is ever committed, hard-coded, or shipped to the
browser — anything prefixed `VITE_` is public by definition and must never hold
a credential.

---

## Engineering rules

These are enforced, not aspirational:

- **Nothing is faked.** No mock bookings, no placeholder ON-AIR badge, no
  payment marked successful without a verified provider callback. An
  unconfigured integration reports itself unconfigured.
- **The server is the authority.** Availability, pricing, booking status and
  payment status are computed and validated server-side. Client input is never
  trusted.
- **Double booking is prevented by the database**, via a PostgreSQL exclusion
  constraint over a time range — not by an application-level check that races.
- **Money is integer KES cents.** Never a float.
- **Every timestamp is `timestamptz` in UTC**, presented in `Africa/Nairobi`.
- **Authorization is checked on every non-public route.** Hidden UI is not
  access control.

---

## Documentation

- [`plan.md`](plan.md) — audit, architecture, database, API, RBAC, phases,
  testing and deployment plan.
