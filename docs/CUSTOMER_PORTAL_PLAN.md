# Customer Portal Plan — finishing the customer dashboard

> Companion to [`plan.md`](../plan.md) §7 (P5, P6, P10, P11, P12) and
> [`DASHBOARD_PLAN.md`](DASHBOARD_PLAN.md) §4.
> Status legend: `PLANNED` · `IN PROGRESS` · `IMPLEMENTED` · `TESTED`
> Written: 2026-09-15

---

## 1. Where things stood when this plan was written (2026-09-15)

This section is the starting position, kept as written. What is true _now_ is
in the implementation record in §7.

The account area at `/account` was built and tested, but it could only
**look**. Every page read real rows, and every list was empty, because nothing
let a customer create those rows:

| A customer wants to…                  | Today                                             |
| ------------------------------------- | ------------------------------------------------- |
| Book a studio session                 | `/book` says online booking is not open           |
| Cancel or move a booking              | No action exists                                  |
| Hire equipment                        | `/equipment` says rental requests are not open    |
| Pay a deposit or balance              | No payment flow; `PAYMENTS_DRIVER` is only a flag |
| Get a receipt                         | Receipt numbers are listed, no receipt page       |
| Hear about changes                    | Notifications are only ever read, never written   |
| Confirm their email, reset a password | No outbound email, so neither exists              |

What is already in place and is reused, not rebuilt:

- The schema: bookings, items, status history, rentals, rental items,
  payments, the append-only payment ledger, refunds, notifications, the
  outbox, preferences, password-reset and email-verification tokens.
- PostgreSQL exclusion constraints that refuse an overlapping booking or an
  overlapping hire of the same unit (`bookings_no_overlap`,
  `equipment_rental_items_no_overlap`).
- Studio settings for the cancellation window, advance-booking limit,
  deposit, late fee and VAT (`booking.*`, `rental.*`, `tax.*`).
- Auth with per-request permissions and `requirePermission`, which was written
  but not yet used by any route, the audit log, the in-process job runner, and
  the account API and pages.

## 2. What "finished" means

The customer dashboard is finished when a signed-in customer can, without
phoning the studio:

1. Find a free slot, see the exact price, and book it.
2. Cancel it — knowing beforehand whether it is free — or move it.
3. Request equipment for a date range, see the price, and cancel the request.
4. Pay a deposit or balance by M-Pesa and get a receipt.
5. Be told, in the app and by email, when anything changes.
6. Confirm their email address and reset a forgotten password.

and every one of those is enforced by the API, recorded in the audit log,
covered by integration tests against the real database, and shown with
loading, empty and error states.

## 3. Principles (carried over, non-negotiable)

- **Nothing is faked.** No demo data, no simulated success in production. The
  mock payment driver is refused when `NODE_ENV=production`, as is the log
  mail driver.
- **The server prices everything.** A total, deposit or amount sent by a
  client is never read.
- **The database has the last word on overlaps.** Application checks give good
  error messages; the exclusion constraints make double booking impossible.
- **Payment status moves only on a verified provider result**, never on what
  the browser says.
- **Money is integer KES cents, in whole shillings.** M-Pesa settles whole
  shillings, so every computed line, tax, deposit and total is rounded to a
  whole shilling. No customer is ever asked for 50 cents they cannot pay.
- **Time is UTC in storage; days and opening hours are Africa/Nairobi.**
- **Ownership is enforced in the query**, as in the rest of `/me`.

## 4. Decisions made in writing this plan

These are the calls this plan makes. Each is cheap to change before its phase
starts and expensive afterwards.

| #   | Decision                                                                                                                                                                                                                             | Why                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Turnaround buffers are enforced **by the exclusion constraint**: a booking stores `blocked_until` (end + the larger of the room's and service's buffer) and the constraint covers `[starts_at, blocked_until)`.                      | A buffer checked only in application code can be beaten by two simultaneous requests.                                           |
| D2  | An unpaid booking holds its room for `booking.payment_hold_minutes` (new setting, default 30). A job cancels lapsed holds unless a payment is in flight.                                                                             | Without an expiry, an abandoned checkout blocks a room forever.                                                                 |
| D3  | The deposit is fixed on the booking when it is made (`deposit_cents`). If `booking.deposit_percent` is not configured, the full total is required.                                                                                   | A later settings change must not alter what an existing customer was quoted. Charging in full is the safe reading of "not set". |
| D4  | Services needing approval start `PENDING_APPROVAL` and hold the room without expiry until staff decide. After approval they move to `PENDING_PAYMENT` (with a hold) or `CONFIRMED` when no deposit is due.                           | Matches the published Booking & Hire Terms.                                                                                     |
| D5  | Cancelling **before** the free-cancellation window opens a `PENDING` refund for everything paid. Cancelling **inside** it is allowed but refunds nothing. The customer is shown which applies before they confirm.                   | The terms promise free cancellation up to the window; refunds are paid by finance staff, so the portal records the request.     |
| D6  | Rescheduling is allowed only before the free-cancellation window, creates a new booking row, marks the old one `RESCHEDULED`, and moves its payments to the new row in the same transaction, with an audit entry.                    | The schema already models moves as a chain (`rescheduled_to_id`); moving outside the window would dodge the cancellation terms. |
| D7  | Equipment is hired by whole studio days: out at opening time on the first day, back by closing time on the last. Both days must be open days. A hire is always `PENDING_APPROVAL` until staff approve it; payment opens on approval. | Units are checked out and back in by staff in opening hours.                                                                    |
| D8  | A rental's total is hire charge + VAT + refundable deposits (+ late and damage fees later). The deposit is shown as its own line.                                                                                                    | Keeps "balance due" a single honest number across bookings and hires.                                                           |
| D9  | M-Pesa STK Push is the only online payment rail. Card payments (Stripe) are out of scope.                                                                                                                                            | No card credentials exist; the plan does not ship a button that cannot work.                                                    |
| D10 | Daraja callbacks are unsigned, so a callback is trusted only after an **STK Push Query** back to Safaricom confirms it, plus a secret path segment and an optional source-IP allowlist.                                              | plan.md §6. A forged callback must not be able to mark a payment paid.                                                          |
| D11 | Email goes through SMTP (`MAIL_DRIVER=smtp`), which works with any provider. SMS and WhatsApp are not sent; the preferences page says so.                                                                                            | Provider-neutral; no SMS or WhatsApp credentials exist.                                                                         |
| D12 | The minimum staff side the customer flows depend on — approve or reject a booking or hire, check equipment out and in — ships as **API only**, behind `requirePermission`. Its screens belong to the admin dashboard (P13).          | Without it, an approval-required booking or any hire could never progress, and the flows could not be tested end to end.        |

## 5. Phases

Each phase ends green — typecheck, lint, format, every server and client test,
and the build — and updates this document's §7 record before the next starts.

```
A booking engine ─► B booking UI
       │
       ├──────────► C equipment hire ─┐
       │                              ├─► D payments ─► E notifications ─► F email verification
       └──────────────────────────────┘                                    & password reset
                                                     G staff decisions API ◄── A, C (E for messages)
                                                     H dashboard finish & release ◄── all
```

### Phase A — Booking engine (server)

**Schema** (migration `booking_engine`)

- `bookings.blocked_until` (nullable timestamptz; null means no turnaround)
  and `bookings_no_overlap` rebuilt over
  `tstzrange(starts_at, COALESCE(blocked_until, ends_at), '[)')`, with a
  `CHECK (blocked_until IS NULL OR blocked_until >= ends_at)`.
- `bookings.deposit_cents` (≥ 0), `bookings.hold_expires_at`, and
  `bookings.package_id` → `photography_packages`.
- Partial index for the hold sweep. Seed setting
  `booking.payment_hold_minutes = 30`.

**API**

| Method | Path                          | Auth                 | Purpose                                                                                       |
| ------ | ----------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/availability`               | public               | Slots for `service`, `room`, `date`, `duration`, each available or not                        |
| POST   | `/bookings/quote`             | public               | Server price: lines, VAT, total, deposit, approval, whether the slot is free                  |
| POST   | `/me/bookings`                | `booking:create`     | Create a booking                                                                              |
| GET    | `/me/bookings/:id`            | `booking:read:own`   | Detail: items, history, payments, deposit, balance, hold, what cancel and reschedule would do |
| POST   | `/me/bookings/:id/cancel`     | `booking:cancel:own` | Cancel per D5                                                                                 |
| POST   | `/me/bookings/:id/reschedule` | `booking:update:own` | Move per D6                                                                                   |

**Rules checked on create and reschedule**, inside one transaction holding a
per-room advisory lock: service active and delivered in that room; room and
studio active; start in the future and within `booking.max_advance_days`;
start aligned to the service's slot interval from opening time; duration
within the service's bounds and a multiple of the interval; the session inside
that day's opening hours; no blackout for the studio or room; no scheduled or
live show airing in the room; no other holding booking (including buffers).
The exclusion constraint backs the last check; its violation becomes
`409 SLOT_UNAVAILABLE`.

**Pricing** (pure, unit-tested): `HOURLY` = rate × minutes ÷ 60 (room override,
else base); `SESSION` = flat rate; `PACKAGE` = the chosen package's price
(required when the service has packages). VAT from `tax.vat_percent` on the
subtotal. Deposit per D3. All rounded to whole shillings.

**Job** `bookings.expire-holds` every minute (D2), writing status history.

**Tests**: slot generation at day edges, closed days, buffers, blackouts, show
airings, past and far-future dates; pricing for all three models; create
success, approval path, misaligned and out-of-hours rejections, blackout,
overlap, buffer overlap refused by the database, **ten simultaneous identical
requests produce exactly one booking**; detail visible to its owner only;
cancel inside and outside the window, with refunds; reschedule moves payments;
hold expiry skips bookings with a payment in flight; customer gets 403 without
the permission.

### Phase B — Booking UI (client)

- `/book` becomes a three-step flow — service, time, review — whose state lives
  in the URL, so a visitor sent to sign in comes back to the same slot.
  Availability is a real slot grid; the review step shows the server quote and
  the cancellation terms. Signing in is asked for only at "Confirm booking".
- `/services` "Book this service" preselects the service.
- `/account/bookings/:id`: summary, price breakdown, status timeline, payments,
  and Cancel (a dialog saying whether it is free and what is refunded) and
  Reschedule (the same slot picker). List rows link to it.
- A shared accessible `Dialog` component.
- **Tests**: each step, sign-in hand-off preserving the slot, quote display,
  slot taken between choosing and confirming, cancel dialog both ways,
  reschedule.

### Phase C — Equipment hire (server and client)

- **Schema**: `equipment_rentals.tax_cents`.
- **API**: `GET /equipment/availability?from&to` (units free per product for
  the window, public); `POST /equipment/hire-quote` (public);
  `POST /me/rentals` (`rental:create`); `GET /me/rentals/:id`;
  `POST /me/rentals/:id/cancel` (while `PENDING_APPROVAL` or `APPROVED` and
  before collection, with refunds per D5).
- **Allocation**: inside one transaction holding advisory locks on each
  product (in a fixed order, so two requests cannot deadlock), pick units that
  are not retired, not in maintenance status, not damaged, with no open
  maintenance ticket overlapping the window. The exclusion constraint refuses
  any unit already out; that becomes `409 EQUIPMENT_UNAVAILABLE`.
- **Client**: a `/hire` page (dates, products with quantities and live
  availability, quote, request), reached from each card on `/equipment`, with
  selection kept in the URL; `/account/rentals/:id` with cancel.
- **Tests**: availability counts across overlapping hires and maintenance,
  pricing by days, allocation never double-assigns under parallel requests,
  unavailable product refused, cancel frees the units, ownership.

### Phase D — Payments (server and client)

- **Gateway interface** with two drivers: `daraja` (OAuth token cache, STK
  Push, STK Push Query) and `mock` (development and tests only; refused in
  production). New env: consumer key and secret, shortcode, passkey, callback
  URL, callback secret, optional IP allowlist, validated at boot when the
  driver is `daraja`.
- **API**: `POST /me/payments` with a required `Idempotency-Key`, strict rate
  limit, body `{ target: booking | rental, option: deposit | balance, phone }`,
  amount computed on the server; `GET /me/payments/:id` (polled while
  pending); `GET /me/payments/:id/receipt`;
  `POST /payments/mpesa/callback/:secret` (public).
- **Callback handling**: record the raw event in `payment_transactions` first
  (unique provider reference, so a replay is a no-op); verify per D10; settle in
  a transaction guarded on the payment still being pending. Settlement confirms
  a `PENDING_PAYMENT` booking once its deposit is covered; money arriving for a
  cancelled booking opens a refund. An amount mismatch is never settled — it is
  logged and audited for staff.
- **Job** `payments.reconcile`: queries pending payments past their expiry and
  settles or fails them from Safaricom's answer.
- **Client**: a pay dialog on booking and hire detail (deposit or balance,
  M-Pesa number, "check your phone" state with polling, success and failure
  outcomes), and a printable receipt page linked from the payments list.
- **Tests**: amount computed server-side, idempotency, a second payment while
  one is in flight refused, callback success confirms the booking, failed
  callback, **unverifiable callback is recorded and ignored**, **duplicate
  callback changes nothing**, wrong secret rejected, late payment on a
  cancelled booking opens a refund, reconcile job, Daraja driver request shapes
  against a stubbed `fetch`.

### Phase E — Notifications (server and client)

- **Schema**: nullable unique `dedupe_key` on `notifications` and
  `notification_outbox`.
- **`notify()`** writes the in-app notification and, when the customer's
  preference for that category allows it, an `EMAIL` outbox row — in the same
  transaction as the change it reports.
- **Events**: booking made, awaiting approval, confirmed, cancelled (by the
  customer, or hold lapsed), moved; hire requested, cancelled; payment
  received, failed; refund opened.
- **Mailer**: `MAIL_DRIVER=smtp | log` (log refused in production), plain text
  and HTML templates with escaping.
- **Jobs**: `notifications.dispatch` claims due outbox rows with a lease (so
  several API instances never send twice), retries with backoff, and fails
  after `max_attempts`; `notifications.reminders` sends a reminder a day before
  a session and before a hire is due back, deduplicated by key.
- **Client**: notifications link to the booking, hire or payment they are
  about; the preferences page says SMS and WhatsApp are not available yet.
- **Tests**: every event writes the right rows, preferences respected, marketing
  never sent without opt-in, dispatcher lease and retry, reminder sent once.

### Phase F — Email verification and password reset

- **API**: `POST /auth/email-verification` (signed in, strict limit),
  `POST /auth/verify-email`, `POST /auth/forgot-password` (always the same
  answer, strict limit), `POST /auth/reset-password` (signs out every device).
  Tokens are 256-bit, stored hashed, single use; a new one retires older ones;
  verification lasts 24 hours and reset 1 hour.
- Registration sends the confirmation email.
- **Client**: `/verify-email`, `/forgot-password`, `/reset-password`; "Forgot
  password?" on sign-in; the overview's unconfirmed-email notice gains "Send
  confirmation link".
- **Tests**: expiry, reuse, enumeration resistance, sessions revoked on reset,
  audit rows.

### Phase G — Staff decisions API (D12)

- `POST /admin/bookings/:id/approve | reject` (`booking:approve`).
- `POST /admin/rentals/:id/approve | reject` (`rental:approve`),
  `/checkout` (`rental:checkout`, condition out),
  `/return` (`rental:return`, condition in, late fee from
  `rental.late_fee_percent_per_day`, damage fee).
- Each transition writes history or item conditions, an audit row and a
  customer notification.
- **Tests**: each transition, illegal transitions refused, **a customer gets
  403**, late-fee arithmetic.

### Phase H — Dashboard finish and release

- Overview "Needs your attention": bookings awaiting payment with their hold
  deadline, approved hires awaiting payment, failed payments — each with its
  action.
- Route-level code splitting to clear the 500 kB bundle warning.
- plan.md §11, README and DASHBOARD_PLAN.md brought up to date.
- A full run: typecheck, lint, format, all tests, build, and a smoke test of
  book → pay (mock) → confirm → cancel against a seeded development database.

## 6. Out of scope

Card payments (D9); SMS and WhatsApp delivery (D11); staff screens (P13);
executing refunds through Safaricom (finance staff, P10 admin); automatic
`IN_PROGRESS`, `COMPLETED` and `NO_SHOW` transitions; private deliverable
downloads, which need signed object-storage URLs (P9); reports (P14).

## 7. Implementation record

**Where this stopped: phases A, B and C are done, tested and pushed**
(`4d533d2`, `2af3bb7` on `feature/auth-and-dashboards`). A customer can find a
free slot, see the price, book it, cancel or move it, and request an equipment
hire — but cannot yet pay for any of it.

**Next up is phase D, payments.** It needs the M-Pesa Daraja credentials in
`server/.env` to run against the sandbox (`PAYMENTS_DRIVER=daraja`), and a
public HTTPS callback URL through a tunnel; with `PAYMENTS_DRIVER=mock` it can
be built and tested without either. Everything D needs from the API is already
in place: bookings and hires carry their deposit, total and balance, and the
payment tables and refund flow are already written to.

| Phase                       | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Booking engine            | TESTED  | Migration `20260916090000_booking_engine`; `/availability`, `/bookings/quote`, `/me/bookings` (create, detail, cancel, reschedule); pricing in `lib/pricing.ts`; slot logic in `availability.service.ts`; hold sweep in the scheduler. 27 booking tests and 9 pricing tests; 134 server tests pass. `requirePermission` now guards its first routes. Drift check: empty diff.                                                                                                                                                        |
| B Booking UI                | TESTED  | `/book` is a three-step flow whose state lives in the URL, so signing in returns to the slot already chosen; `/account/bookings/:id` with a cancel dialog that says what would be refunded, and `/account/bookings/:id/reschedule`; new `Dialog`, `SlotPicker` and `QuoteSummary`; list rows link through. `slotIntervalMinutes` added to the public catalogue so offered lengths match the server's grid. 104 client tests pass. A test caught the dialog stealing focus mid-typing; its focus handling was rebuilt.                |
| C Equipment hire            | TESTED  | Migration `20260916140000_equipment_hire` (a hire carries its own VAT; refundable deposits are never taxed). `GET /equipment/availability` and `POST /equipment/hire-quote` are public; `/me/rentals` request, detail and cancel are not. The server allocates units under an advisory lock per product, with `equipment_rental_items_no_overlap` as the backstop. New permission `rental:cancel:own`. Client: `/hire` and `/account/rentals/:id`, reached from the equipment catalogue. 149 server tests and 115 client tests pass. |
| D Payments                  | PLANNED |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E Notifications             | PLANNED |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F Email verification, reset | PLANNED |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| G Staff decisions API       | PLANNED |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| H Dashboard finish, release | PLANNED |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
