# Dashboard Plan — Admin (staff) and User (customer) dashboards

> Companion to [`plan.md`](../plan.md) §7 phases P3, P12 and P13.
> Status legend: `PLANNED` · `IN PROGRESS` · `IMPLEMENTED` · `TESTED`
> Written: 2026-09-11

---

## 1. Why this document exists

The brief asks for two dashboards:

| Dashboard     | Audience                                                              | Route      | API                           |
| ------------- | --------------------------------------------------------------------- | ---------- | ----------------------------- |
| **User**      | every signed-in account (customers, and staff for their own bookings) | `/account` | `GET /api/v1/me/dashboard`    |
| **Admin/Ops** | staff roles holding `dashboard:view`                                  | `/admin`   | `GET /api/v1/admin/dashboard` |

Both depend on knowing **who** is asking, and the admin one depends on **what
they may see**. At the time of writing, authentication (P3) did not exist. A
dashboard with no identity behind it would either be empty or fake, and this
project does not ship fake screens. So this plan delivers, in order:

1. **Auth core (P3)** — register, login, rotating refresh sessions, logout,
   `me`, and the `requireAuth` / `requirePermission` middleware.
2. **Dashboard APIs** — two aggregate endpoints computed from real rows.
3. **Dashboard UIs** — an authenticated app shell, guards, and both pages.

Operational modules that _feed_ the dashboards (booking engine P5, equipment
lifecycle P6, show occurrence job P7, payments P10, notifications P11) are not
built yet. The dashboards read their tables directly, so the day those modules
start writing rows, the dashboards show them — no rework. Until then every
panel renders an honest empty state.

---

## 2. Principles (non-negotiable)

- **Nothing is faked.** No seeded demo bookings, no sample revenue, no
  hard-coded "ON AIR". An empty table renders an empty state that says why.
- **The server decides what a viewer sees.** The admin endpoint returns only
  the sections the caller's permissions allow; sections they may not see are
  _absent from the payload_, not hidden by CSS.
- **Ownership is enforced in the query.** The user dashboard filters every
  query by `customerId = req.user.id`. No endpoint accepts a user id for it.
- **Money is integer KES cents**, formatted only at the edge.
- **Time is UTC in storage; "today" means today in the studio's timezone**
  (`Africa/Nairobi`), computed server-side.
- **ON AIR is never inferred from the clock.** An airing is live only when its
  occurrence status is `LIVE`. An airing whose window covers "now" but was not
  started is reported separately as _scheduled now — not on air_.

---

## 3. Auth core (prerequisite)

### 3.1 Endpoints

| Method | Path             | Auth              | Notes                                                        |
| ------ | ---------------- | ----------------- | ------------------------------------------------------------ |
| POST   | `/auth/register` | public, strict RL | Creates a `CUSTOMER`, starts a session, returns token + user |
| POST   | `/auth/login`    | public, strict RL | Email + password; returns token + user, sets refresh cookie  |
| POST   | `/auth/refresh`  | refresh cookie    | Rotates the refresh token, returns a new access token + user |
| POST   | `/auth/logout`   | refresh cookie    | Revokes the whole session family, clears the cookie          |
| GET    | `/auth/me`       | Bearer            | Current principal with roles and permissions                 |

### 3.2 Tokens and sessions

- **Access token** — HS256 JWT via `jose`, 15 min (`JWT_ACCESS_TTL`), claims
  `sub`, `sid`, `iss`, `aud`. Held in memory on the client only.
- **Refresh token** — 256-bit random, stored only as SHA-256 in `sessions`,
  cookie `bmd_rt`: `httpOnly`, `SameSite=Strict`, `Secure` per env, path
  `/api/v1/auth`, 30 days.
- **Rotation** — each refresh creates a new session row in the same
  `familyId` and marks the old one `revoked_reason='rotated'` with
  `replaced_by_hash`. The swap uses a conditional update so two concurrent
  refreshes cannot both win.
- **Reuse detection** — presenting a rotated token more than 30 s after it was
  rotated revokes the entire family (`reuse_detected`) and writes an audit row.
  Within 30 s it is treated as a benign multi-tab race: `409 CONFLICT`, the
  client retries with the cookie the browser already holds.
- **Per-request authorisation from the database.** `requireAuth` verifies the
  JWT, then loads the session, the user's status and their current role
  grants in one query. Consequence: a suspended account, a logout or a revoked
  permission takes effect on the very next request, not 15 minutes later.
  (Deliberate deviation from plan.md §3.4, which put permissions in the token.)
- **Registration status** — accounts are created `ACTIVE` with
  `email_verified_at = null`. Enforced verification needs outbound email
  (P11); it is listed as remaining work, not claimed.
- **Enumeration resistance** — an unknown email still runs an argon2 verify
  against a dummy hash, and "inactive account" is only revealed after the
  correct password.

---

## 4. User dashboard — `GET /me/dashboard`

Guard: `requireAuth`. Every query is scoped to the caller.

| Block              | Content                                                                                                                        | Source                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `profile`          | name, email, phone, status, email verified?, member since, roles                                                               | `users`, `user_roles`              |
| `stats`            | upcoming bookings · active rentals · **balance due** · total paid · unread notifications                                       | aggregates below                   |
| `upcomingBookings` | next 5 holding bookings (`PENDING_*`, `CONFIRMED`, `IN_PROGRESS`) ending after now: room, service, window, status, total, paid | `bookings` + successful `payments` |
| `recentBookings`   | last 5 bookings that have ended or were cancelled                                                                              | `bookings`                         |
| `activeRentals`    | rentals `PENDING_APPROVAL`/`APPROVED`/`CHECKED_OUT`/`OVERDUE`, item names, window, overdue flag                                | `equipment_rentals` + items        |
| `recentPayments`   | last 5 payments: reference, purpose, provider, status, amount                                                                  | `payments`                         |
| `notifications`    | latest 5 in-app notifications                                                                                                  | `notifications`                    |
| `deliverables`     | latest 5 deliverables on the caller's bookings, pending or delivered                                                           | `booking_deliverables`             |

**Balance due** = Σ over the caller's billable bookings (`PENDING_PAYMENT`,
`PENDING_APPROVAL`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`) and rentals
(`APPROVED`, `CHECKED_OUT`, `OVERDUE`, `RETURNED`) of
`max(0, total − Σ SUCCESSFUL payments linked to it)`.

UI (`/account`): greeting + verification notice, 4 stat tiles, "Upcoming
sessions" list, "Equipment on hire", "Payments", "Notifications",
"Deliverables", quick actions (book, hire equipment). Each block has its own
empty state. A staff member also sees a link to the ops dashboard.

---

## 5. Admin / operations dashboard — `GET /admin/dashboard`

Guard: `requirePermission('dashboard:view')`. Response:

```jsonc
{
  "generatedAt": "2026-09-11T07:00:00.000Z",
  "timezone": "Africa/Nairobi",
  "today": "2026-09-11",
  "sections": { "onAir": {…}, "bookings": {…}, … } // only permitted keys
}
```

| Section     | Required permission | Content                                                                                                                      |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `onAir`     | `show:read`         | occurrences `LIVE` now · `SCHEDULED` covering now (not on air) · next 3 airings · live streams with platforms                |
| `bookings`  | `booking:read:any`  | today's bookings (list + count) · pending approval (count + 5) · pending payment count · next-7-days count · today by status |
| `rooms`     | `booking:read:any`  | per active room today: open minutes (operating hours − closed days), booked minutes clipped to opening hours, utilisation %  |
| `rentals`   | `rental:read:any`   | pending approval · checked out · overdue (`OVERDUE`, or `CHECKED_OUT` past `ends_at`) · due back today (list)                |
| `equipment` | `equipment:read`    | units by status · units in `POOR`/`DAMAGED` condition · open maintenance tickets                                             |
| `revenue`   | `payment:read:any`  | successful today / last 7 days / month-to-date · pending count · failed today · pending refunds · 14-day daily series        |
| `users`     | `user:read`         | total · customers · staff · new in 7 days · suspended/disabled                                                               |
| `activity`  | `audit:read`        | latest 10 audit entries with actor                                                                                           |
| `system`    | `settings:write`    | notification outbox queued/failed · scheduler jobs with last run and status                                                  |

What each role therefore sees (from the seeded grants):

| Section   | SUPER | S.ADMIN | MANAGER | PRODUCER | PRESENTER | TECH | MEDIA | FINANCE |
| --------- | :---: | :-----: | :-----: | :------: | :-------: | :--: | :---: | :-----: |
| onAir     |   ✓   |    ✓    |    ✓    |    ✓     |     ✓     |  ✓   |   ✓   |    ✓    |
| bookings  |   ✓   |    ✓    |    ✓    |    ✓     |     —     |  ✓   |   ✓   |    ✓    |
| rooms     |   ✓   |    ✓    |    ✓    |    ✓     |     —     |  ✓   |   ✓   |    ✓    |
| rentals   |   ✓   |    ✓    |    ✓    |    —     |     —     |  ✓   |   —   |    ✓    |
| equipment |   ✓   |    ✓    |    ✓    |    ✓     |     ✓     |  ✓   |   ✓   |    ✓    |
| revenue   |   ✓   |    ✓    |    ✓    |    —     |     —     |  —   |   —   |    ✓    |
| users     |   ✓   |    ✓    |    ✓    |    —     |     —     |  —   |   —   |    —    |
| activity  |   ✓   |    ✓    |    —    |    —     |     —     |  —   |   —   |    —    |
| system    |   ✓   |    ✓    |    —    |    —     |     —     |  —   |   —   |    —    |

Sections are computed in parallel; the revenue series is a single
parameterised `GROUP BY` on the Nairobi calendar day.

UI (`/admin`): app shell with a permission-filtered sidebar. Top: ON AIR strip
(only rendered red when something is genuinely `LIVE`). KPI row (today's
bookings, pending approvals, overdue rentals, revenue today — each only if its
section is present). Then: today's schedule table, approval queue, room
utilisation bars, 14-day revenue bars, equipment status, users, recent
activity, system health.

---

## 6. Client architecture

```
client/src/
├── features/auth/        api.ts · AuthProvider.tsx · useAuth.ts · guards.tsx
│                         LoginPage.tsx · RegisterPage.tsx
├── features/dashboard/   api.ts · format.ts · components/{StatCard, Panel,
│                         BookingStatusBadge, RevenueChart, UtilisationBar}
├── layouts/DashboardLayout.tsx      sidebar shell shared by /account and /admin
└── pages/{account,admin}/*DashboardPage.tsx
```

- `AuthProvider` restores the session on load with one `POST /auth/refresh`
  (the cookie is the only persisted credential), then refreshes ahead of
  access-token expiry.
- The Axios client retries a request once after a single-flight refresh when it
  receives `401`; a failed refresh drops the app to signed-out.
- `RequireAuth` redirects to `/login` preserving the target; `RequirePermission`
  renders an explicit 403 page. Both are UX only — the API enforces.
- After login: staff with `dashboard:view` land on `/admin`, everyone else on
  `/account`, unless they were sent to login from a specific page.
- Sidebar links for modules that do not exist yet open the existing honest
  placeholder naming their phase.
- Data via TanStack Query, 60 s refetch on the admin dashboard so "today" stays
  current on a studio wall screen.

---

## 7. Shared contracts (`@bmd/shared`)

- `auth.ts` — `loginSchema`, `registerSchema` (Zod; used by server validation
  _and_ client forms), `AuthUser`, `AuthSession`.
- `dashboard.ts` — `CustomerDashboard`, `AdminDashboard` and section DTOs.
  Dates travel as ISO strings.

---

## 8. Tests

| Suite                                        | Proves                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/tests/integration/auth.test.ts`      | register valid / duplicate / weak; login ok / wrong password / unknown email / suspended; `me` with and without token; refresh rotation; **reuse of a rotated token revokes the family**; logout kills refresh _and_ outstanding access tokens; suspension takes effect immediately                                                         |
| `server/tests/integration/dashboard.test.ts` | 401 unauthenticated; **customer gets 403 on admin**; customer sees only own bookings; balance due arithmetic; super admin receives every section with correct counts; FINANCE gets revenue but not users/activity/system; PRESENTER gets no bookings; ON AIR distinguishes `LIVE` from scheduled-now; revenue series buckets by Nairobi day |
| `server/tests/unit/time.test.ts`             | Nairobi day boundaries and weekday at UTC edges                                                                                                                                                                                                                                                                                             |
| client `*.test.tsx`                          | guards redirect / forbid; login surfaces invalid credentials; both dashboards render data, empty states, and only the sections present                                                                                                                                                                                                      |

---

## 9. Delivery checklist

| #   | Item                                                              | Status  |
| --- | ----------------------------------------------------------------- | ------- |
| 1   | Env: JWT secret/TTL, refresh TTL, cookie config                   | see §10 |
| 2   | Server auth: tokens, passwords, service, middleware, routes       | see §10 |
| 3   | Shared auth + dashboard contracts                                 | see §10 |
| 4   | `GET /me/dashboard`                                               | see §10 |
| 5   | `GET /admin/dashboard` with permission-gated sections             | see §10 |
| 6   | Integration + unit tests                                          | see §10 |
| 7   | Client auth provider, refresh interceptor, guards, login/register | see §10 |
| 8   | Dashboard shell + user dashboard                                  | see §10 |
| 9   | Admin dashboard                                                   | see §10 |
| 10  | Client tests, typecheck, lint, build                              | see §10 |
| 11  | plan.md / README status updates                                   | see §10 |

---

## 10. Implementation record

_Filled in when the work lands — see the bottom of this file._

### Out of scope here (tracked in plan.md)

User/role administration UI, password reset and email verification (need
P11 mail), the booking/rental/payment workflows themselves (P5, P6, P10), the
occurrence expansion job (P7), and exports/reports (P14).
