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

| Phase                  | Status                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| P0 Audit and plan      | **Implemented** — [`plan.md`](plan.md)                                     |
| P1 Foundation          | **Implemented** — monorepo, API skeleton, client shell, tooling, tests, CI |
| P2 Database (Prisma)   | **Tested** — full schema, migrations, overlap constraints, seed            |
| P3 Auth and RBAC       | Planned — next                                                             |
| P4 Studio and services | **In progress** — public service catalogue API and page                    |
| P6 Equipment           | **In progress** — public hire catalogue API and page                       |
| P5, P7 – P17           | Planned — see [`plan.md`](plan.md) §7                                      |

What actually works today: the API boots, serves `/api/v1/health` and
`/api/v1/health/ready` behind hardened headers, rate limiting, request
correlation ids and a central error handler, and reports a real round-tripped
database check in its readiness probe; the web client builds, routes, and
renders a real connection panel driven by the live API. The database schema is
complete and migrated, and double booking is refused by PostgreSQL itself —
proven by an integration suite that fires ten simultaneous identical bookings
and asserts exactly one survives.

The public Services and Equipment pages read the live catalogue from
`GET /api/v1/services/catalogue` and `GET /api/v1/equipment/catalogue`. Only
active services deliverable in an open room are listed, equipment is grouped
into products with a count of units on the shelf and fit to hire, and asset
tags, serial numbers and store locations never leave the server.

There is no authentication, no booking or rental API and no staff editing of
the catalogues yet — the routes for those modules show an honest placeholder
naming the phase that delivers them.

---

## Stack

| Layer       | Technology                                                                |
| ----------- | ------------------------------------------------------------------------- |
| Client      | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| Server      | Node.js, Express 5, TypeScript, Zod, Pino                                 |
| Database    | PostgreSQL 16 + Prisma 6                                                  |
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

# 5. apply migrations and seed the reference data
npm run db:migrate --workspace=server
npm run db:seed --workspace=server

# 6. run the API and the web client
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173
```

The seed creates a `SUPER_ADMIN` only when `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` are set in `server/.env`. There is deliberately no default
password in any environment.

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

Database commands run in the `server` workspace
(`npm run <script> --workspace=server`):

| Command       | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `db:migrate`  | Create and apply a migration in development                    |
| `db:deploy`   | Apply committed migrations — the production and CI path        |
| `db:generate` | Regenerate the Prisma client after a schema change             |
| `db:seed`     | Seed roles, permissions, studio, services, equipment and shows |
| `db:reset`    | Drop, re-migrate and re-seed the development database          |
| `db:studio`   | Open Prisma Studio                                             |

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
  See `server/prisma/migrations/*_exclusion_constraints/migration.sql`, and the
  concurrency test in `server/tests/integration/overlap-constraints.test.ts`.
- **Integration tests run against a real PostgreSQL instance.** The booking
  guarantees are database constraints, so a mocked database would prove nothing.
- **Money is integer KES cents.** Never a float.
- **Every timestamp is `timestamptz` in UTC**, presented in `Africa/Nairobi`.
- **Authorization is checked on every non-public route.** Hidden UI is not
  access control.

---

## Documentation

- [`plan.md`](plan.md) — audit, architecture, database, API, RBAC, phases,
  testing and deployment plan.
