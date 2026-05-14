# HansMed Modern TCM — Backend

Full backend for a TCM (Traditional Chinese Medicine) platform built around
patient tongue diagnosis, doctor video consultations, electronic prescriptions,
and a pharmacy fulfillment + ordering flow. Stack: **Laravel 11 + MySQL 8 +
Redis + Sanctum**.

## Contents

- `database/schema.sql` — canonical MySQL schema (25 tables, source of truth)
- `backend/` — Laravel application (models, controllers, services, jobs, tests)
- `docs/openapi.yaml` — OpenAPI 3 spec
- `requests.http` — VSCode/JetBrains HTTP client collection covering every endpoint
- `docker-compose.yml` + `docker/nginx.conf` — one-command local dev
- `HansMed_Modern_TCM_3.html` — original UI prototype

## Quick start (Docker)

```bash
# 1. bring up mysql/redis/php/nginx/queue
docker compose up -d

# 2. bootstrap Laravel once
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate   # or use schema.sql (see below)
docker compose exec app php artisan db:seed
docker compose exec app php artisan storage:link

# 3. hit it
curl http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@hansmed.test","password":"password"}'
```

> Schema is provided as raw SQL (`database/schema.sql`) rather than Laravel
> migrations because the 25-table schema with FKs/enums/JSON columns is cleaner
> that way. The Docker image auto-loads it via the MySQL init hook. If you
> prefer migrations, generate them from the existing database with
> `php artisan migrate:generate` (requires the `kitloong/laravel-migrations-generator` package).

## Demo accounts (after seeding)

All passwords: `password`

| Role     | Email                     |
|----------|---------------------------|
| admin    | admin@hansmed.test        |
| patient  | patient@hansmed.test      |
| doctor   | doctor@hansmed.test       |
| pharmacy | pharmacy@hansmed.test     |

Create an additional admin:
```bash
php artisan hansmed:create-admin ops@hansmed.test --password=change-me
```

## Running the tests

```bash
php artisan test
```

Tests cover: auth (register/login/pending state), booking conflict detection,
prescription issuance, and order placement with stock decrement on dispense.

## Architecture

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Patient  │   │  Doctor  │   │ Pharmacy │   │  Admin   │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     └──────────────┴───────┬──────┴──────────────┘
                            │ Sanctum bearer token
                    ┌───────▼────────┐
                    │  Laravel API   │  routes/api.php
                    └───┬────────┬───┘
         ┌──────────────┤        ├──────────────┐
         │              │        │              │
   ┌─────▼────┐  ┌──────▼──┐  ┌──▼─────┐  ┌─────▼─────┐
   │  MySQL   │  │  Redis  │  │ Queue  │  │ External  │
   │ (25 tbl) │  │ (cache) │  │ worker │  │ adapters  │
   └──────────┘  └─────────┘  └────────┘  └───────────┘
                                              │
                   ┌──────────────┬───────────┼────────────┬──────────────┐
                   │              │           │            │              │
              Stripe SDK     PayPal v2     Agora RTC   Tongue AI      (future)
```

### Key design decisions

- **Single `users` table + role enum** + per-role profile tables (patient / doctor / pharmacy). Shared auth pipeline with role-scoped routes via `role:` middleware.
- **Doctors & pharmacies start `pending`** — can register but cannot log in until admin approval (M-03/M-04).
- **Prescription revisions preserve history**: a revise creates a new row with `parent_id` pointing at the old one (status flipped to `revised`), never a destructive edit — meets the audit requirement from the product spec (难点1).
- **Polymorphic `payments` table** keyed by `payable_type` (`appointment` | `order`), so Stripe and PayPal both converge on one write target.
- **Tongue diagnosis adapter** (`TongueDiagnosisClient`) stores both the raw third-party JSON and the parsed/normalized fields. Runs async via a queued job so upload latency stays low (难点2).
- **Agora token building** done in-process (no SDK dependency) — minimal AccessToken2 implementation.
- **Stripe webhook** verifies the `Stripe-Signature` HMAC with a 5-minute replay window.
- **Inventory transitions are row-locked**: `dispense/finish` wraps stock decrement + movement row in a transaction with `lockForUpdate`.

## State machines

```
appointment: pending_payment → confirmed → in_progress → completed
                               ↘ cancelled / no_show

prescription: draft → issued → (revised | revoked | dispensed)

order: pending_payment → paid → dispensing → dispensed → shipped →
       delivered → completed
                     ↘ cancelled / refunded / after_sale

withdrawal: pending → (approved → paid) | rejected
```

## API surface (~65 endpoints)

See `docs/openapi.yaml` for the spec and `requests.http` for a ready-to-use
collection. High-level groups:

```
POST   /api/auth/register|login|logout    GET /api/auth/me
POST   /api/webhooks/stripe
GET    /api/notifications                 POST /api/notifications/{id}/read
GET    /api/consultations/{id}/join       POST /api/consultations/{id}/finish
POST   /api/payments/paypal/create|capture

# patient
GET/PUT /api/patient/profile
CRUD    /api/patient/addresses
CRUD    /api/patient/tongue-diagnoses
GET     /api/patient/doctors[/{id}]  /pharmacies
GET/POST /api/patient/appointments   POST .../cancel
GET      /api/patient/prescriptions
GET/POST /api/patient/orders[/{id}]

# doctor
GET      /api/doctor/appointments[/{id}]  POST .../start, .../complete
GET/POST /api/doctor/prescriptions[/{id}] POST .../revoke, .../revise
GET      /api/doctor/earnings/summary|history
GET/POST /api/doctor/withdrawals

# pharmacy
GET/POST/PUT /api/pharmacy/products[/{id}]  POST .../stock
GET          /api/pharmacy/orders[/{id}]
POST         /api/pharmacy/orders/{id}/dispense/start|finish
POST         /api/pharmacy/orders/{id}/ship
GET          /api/pharmacy/reconciliation/summary|daily

# admin
GET/POST /api/admin/doctors/pending, /doctors/{id}/review
GET/POST /api/admin/pharmacies/pending, /pharmacies/{id}/review
GET      /api/admin/finance/overview
GET/POST /api/admin/finance/withdrawals/pending, .../{id}/review
GET      /api/admin/prescriptions[/{id}]  POST .../revoke
GET/POST /api/admin/configs
GET      /api/admin/reports/dashboard
GET      /api/admin/reports/export/{orders|appointments|payments}
```

## Feature map (from the product spec)

| PDF code | Feature | Status |
|---|---|---|
| C-01..C-03 | Patient auth + profile + health record | ✅ |
| C-04..C-07 | Tongue upload, analysis, history | ✅ (async job) |
| C-09..C-11 | Doctor browse + appointment + pay | ✅ (Stripe + PayPal) |
| C-12..C-17 | Prescription view + order + shipping | ✅ |
| C-18 | Notifications | ✅ |
| D-04..D-07 | Doctor appointments + video | ✅ (Agora) |
| D-08, D-09 | Prescription issue + revise/revoke | ✅ (parent_id audit) |
| D-11, D-12 | Earnings + withdrawals | ✅ |
| D-13 | Doctor notifications | ✅ |
| P-03..P-06 | Pharmacy order + dispense + ship | ✅ |
| P-07, P-08 | Product catalog + inventory | ✅ (row-locked) |
| P-09 | Reconciliation | ✅ |
| P-10 | Pharmacy notifications | ✅ |
| M-03, M-04 | Doctor/pharmacy verification | ✅ |
| M-06 | Prescription oversight | ✅ |
| M-08 | Finance + withdrawals | ✅ |
| M-09 | System config | ✅ |
| M-13 | Reports + CSV export | ✅ |
| E-60 | Tongue diagnosis adapter | ✅ (stub + real) |
| E-61 | Video SDK | ✅ (Agora) |
| E-62 | Payment gateways | ✅ (Stripe + PayPal) |

## Configuration

Copy `backend/.env.example` → `backend/.env` and fill in the keys you care
about. Every external integration has a dev stub that activates when its
credential is empty, so you can run the full app locally with zero external
accounts.

```
STRIPE_SECRET=              # sk_test_...
STRIPE_WEBHOOK_SECRET=      # whsec_...
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
AGORA_APP_ID=
AGORA_APP_CERT=
TONGUE_API_URL=
TONGUE_API_KEY=
```

## Queue worker

The tongue diagnosis job runs through Laravel's queue. In Docker the `queue`
service runs `php artisan queue:work` automatically. Locally:

```bash
php artisan queue:work --tries=3
```

## What's not built (known gaps)

- **Frontend wiring.** The HTML prototype at the repo root is untouched — integrating it with this API is the next piece of work.
- **Doctor schedule UI** (backend supports `doctor_schedules` but there are no CRUD endpoints for it yet — booking currently just checks conflicts against existing appointments).
- **Prescription PDF export** — schema supports it, rendering not wired.
- **Real-time push** (WebSocket/SSE) — notifications persist to DB only; polling is expected.
- **Multi-language content pages** (M-11) — `content_pages` table exists, no admin UI yet.

## Licence

Internal / proprietary. Do not redistribute.
