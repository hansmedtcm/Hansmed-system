# HansMed v2 — Deployment Guide

Clean rebuild of the HansMed TCM telehealth platform under `/v2/`. This folder is self-contained — no build step, no framework, just HTML/CSS/JS served as static files.

## Architecture

- **Frontend**: Static HTML + vanilla JS served from GitHub Pages at `/v2/`
- **Backend**: Laravel 11 + MySQL on Railway (`hansmed-system-production.up.railway.app`)
- **Video**: Jitsi Meet embedded (no SDK, no API key)
- **Payments**: Stripe Malaysia skeleton (Card, FPX, TNG, GrabPay, ShopeePay)

## Directory layout

```
v2/
├── index.html            Landing (public) — hero, services, doctors, contact, auth modal
├── portal.html           Patient portal (auth required, role=patient)
├── doctor.html           Doctor workspace (auth required, role=doctor)
├── pharmacy.html         Pharmacy portal (auth required, role=pharmacy)
├── admin.html            Admin console (auth required, role=admin)
├── 404.html              Deep-link fallback
│
├── assets/
│   ├── css/              Design tokens + component styles
│   └── js/
│       ├── config.js     API_BASE + feature flags
│       ├── api.js        fetch wrapper with auto-logout on 401
│       ├── auth.js       role guards, displayName, session
│       ├── router.js     hash router per page
│       ├── ui.js         toast, modal, drawer, confirm, prompt
│       ├── form.js       serialize, validate, showErrors
│       ├── render.js     template cloning + data binding
│       ├── format.js     money, date, status badges
│       ├── empty.js      loading / empty / error states
│       ├── i18n.js       EN/ZH language switcher
│       ├── bus.js        event bus
│       ├── pages/        one bootstrap per HTML page
│       └── panels/       feature modules per role
│
└── docs/
    └── DEPLOY.md         this file
```

## Deployment

### 1. Backend (Railway) — already live

Backend is already running at `https://hansmed-system-production.up.railway.app`. No changes needed for the frontend rebuild.

To redeploy backend:
```bash
git push origin master          # Railway auto-deploys on push
```

### 2. Frontend (GitHub Pages) — already live

`/v2/` is served automatically once pushed to the `master` branch:
```bash
git push origin master
# Visit: https://hansmedtcm.github.io/Hansmed-system/v2/index.html
```

### 3. Promoting v2/ to root (when ready)

When you're happy with `/v2/` and want it to be the main version:

```bash
# 1. Back up current root files
mkdir archive-v1
mv HansMed_Modern_TCM_14.html frontend archive-v1/

# 2. Move v2 files to root
mv v2/* .
rmdir v2

# 3. Commit and push
git add -A
git commit -m "Promote v2 rebuild to root"
git push
```

Old tester link at `HansMed_Modern_TCM_14.html` keeps working until you run step 1.

## Configuration

### Frontend (`v2/assets/js/config.js`)

```js
API_BASE:     'https://hansmed-system-production.up.railway.app/api'
JITSI_DOMAIN: 'meet.jit.si'        // free, no API key
```

To point frontend at a local backend for development:
```js
API_BASE: 'http://localhost:8000/api'
```

### Backend (`backend/.env` on Railway)

Set via Railway dashboard → Variables:
- `APP_URL`
- `DB_*` (auto-injected by Railway MySQL plugin)
- `FRONTEND_URL` (for CORS)

## Database setup

Run once per fresh database:
```sql
-- In Railway MySQL console:
SOURCE database/schema.sql
SOURCE database/all_tables.sql
SOURCE database/seed.sql
```

## Test accounts

Default seeded accounts (from `database/seed.sql`):

| Role      | Email                  | Password      |
|-----------|------------------------|---------------|
| Admin     | admin@hansmed.com      | admin123      |
| Doctor    | doctor@hansmed.com     | doctor123     |
| Pharmacy  | pharmacy@hansmed.com   | pharmacy123   |
| Patient   | patient@hansmed.com    | patient123    |

Change these in production.

## Roles & routes

| HTML file      | Role     | Panels                                                                  |
|----------------|----------|-------------------------------------------------------------------------|
| index.html     | public   | landing, login, register, doctor login, pharmacy login                  |
| portal.html    | patient  | overview, profile, health, doctors, booking, tongue, appts, rx, orders, messages, notifications, video, settings, help |
| doctor.html    | doctor   | dashboard, queue, appointments, consult, patients, prescriptions, schedule, documents, earnings, withdrawals, messages, notifications, profile, help |
| pharmacy.html  | pharmacy | dashboard, orders, inbox, products, pos, finance, notifications, profile, help |
| admin.html     | admin    | dashboard, verifications, accounts, patients, doctors, appointments, prescriptions, orders, finance, withdrawals, content, tongue-config, permissions, audit, config |

All role guards are in `auth.js`. Visiting `portal.html` without auth redirects to `index.html`.

## Verification checklist

Before sending tester link:

- [ ] Visit `/v2/index.html` — hero renders, fonts load, no console errors
- [ ] Register a new patient account → email + password + DOB
- [ ] Patient: see registration wall → complete profile
- [ ] Patient: browse doctors, book appointment, upload tongue image
- [ ] Doctor login: see today's queue, start consult, issue prescription
- [ ] Pharmacy login: see new order, mark dispensed, ship with tracking
- [ ] Admin login: approve pending doctor, view audit log, export CSV
- [ ] Mobile: resize to 375px — sidebar collapses, tables switch to responsive layout

## Known limitations

- **Tongue AI**: runs in demo mode using built-in TCM knowledge base. Configure real provider in Admin → Tongue Config.
- **Payments**: Stripe Malaysia skeleton — plug in real keys before production transactions.
- **Email**: Laravel uses log driver by default. Configure SMTP in Railway env vars for real emails.
- **Video**: Jitsi public servers. For production, deploy your own Jitsi instance for privacy compliance.

## Support

- Backend routes: `backend/routes/api.php`
- API client: `v2/assets/js/api.js`
- Design tokens: `v2/assets/css/tokens.css`
- Issues: contact system admin
