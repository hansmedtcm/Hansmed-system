# HansMed Backend — Setup (Step 1: schema + auth)

## What's in this commit

- `database/schema.sql` — full canonical MySQL 8 schema for the entire platform (users, profiles, tongue diagnoses, questionnaires, appointments, consultations, prescriptions, products/inventory, addresses, orders, shipments, payments, withdrawals, notifications, content, audit). Use this as the source of truth.
- `backend/app/Models/User.php` — User model (maps `password_hash` column to Laravel auth)
- `backend/app/Http/Controllers/Auth/AuthController.php` — register / login / me / logout (Sanctum)
- `backend/app/Http/Middleware/EnsureRole.php` — `role:doctor,admin` route guard
- `backend/routes/api.php` — auth routes + role-gated prefixes for the next step

## Bootstrap a Laravel 11 project around this

```bash
cd E:/Hansmed-system
composer create-project laravel/laravel backend-tmp
# move generated files into ./backend/, keeping the files above
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

In `bootstrap/app.php` register the role middleware alias:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'role' => \App\Http\Middleware\EnsureRole::class,
    ]);
})
```

## Create the database

```bash
mysql -u root -p -e "CREATE DATABASE hansmed CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p hansmed < database/schema.sql
```

Set `.env`:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=hansmed
DB_USERNAME=root
DB_PASSWORD=
```

> Note: I gave you raw SQL (not Laravel migrations) because the schema spans 25+ tables with FKs/enums/JSON columns that map cleanly to MySQL but are noisy in the migration DSL. If you'd rather have migrations, say so and I'll convert them.

## Smoke test

```bash
php artisan serve
# register a patient
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"p1@test.com","password":"password123","role":"patient","nickname":"Alice"}'

# login
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"p1@test.com","password":"password123"}'

# me (use token from above)
curl http://127.0.0.1:8000/api/auth/me -H "Authorization: Bearer <token>"
```

## Design notes

- **Single `users` table + role enum + per-role profile tables** (as you chose). Sanctum tokens are issued with the role as an ability, so policies can check `tokenCan('doctor')`.
- **Doctor / pharmacy accounts start as `pending`** and cannot log in until an admin sets `status = 'active'` via M-03 / M-04. Patients are `active` immediately.
- **Prescription revisions** use `parent_id` self-reference so the original is preserved (audit requirement from PDF 难点1).
- **Order status machine** has all states from C-16 plus refund/after-sale; payments are polymorphic over `appointment` or `order` so Stripe/PayPal callbacks have one table to write.
- **Tongue diagnosis** stores both the parsed fields (color/coating/shape/teeth_marks/cracks/moisture) and the raw third-party JSON, matching the PDF's adapter-layer requirement (难点2).

## Next step suggestions

Pick one to do next:
1. **Patient profile + health record CRUD** (C-02, C-03)
2. **Tongue diagnosis upload + third-party adapter stub** (C-04, C-05, C-06, E-60)
3. **Doctor listing + appointment booking + Stripe payment** (C-09, C-10, E-62)
4. **Admin: doctor/pharmacy verification flow** (M-03, M-04)
