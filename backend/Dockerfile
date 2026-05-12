# HansMed backend Dockerfile.
#
# 2026-05-12 — REVERTED from Laravel Octane + FrankenPHP back to
# `php artisan serve`. The Octane migration broke CORS in a way we
# could not diagnose without shell access to the running container:
# HandleCors middleware silently stopped emitting Access-Control-*
# headers, taking patient/doctor portals + login offline. Three fix
# attempts (HandleCors prepend, custom HansMedCors middleware,
# Caddyfile at the HTTP layer) all failed. Rolling Octane back
# restores the known-working Laravel middleware stack at the cost of
# the 5-8x performance regression. Octane will be re-attempted in a
# separate dev environment with proper observability.
#
# Trade-off accepted: ~1-4s/request (was ~100-300ms under Octane) in
# exchange for a working production site. Acceptable during soft-launch
# while we figure out the real Octane interaction.
#
# Mirror image of backend/nixpacks.toml — if both exist, Railway picks
# this Dockerfile.

FROM php:8.3-cli

# System packages + PHP extensions for Laravel + AWS S3 (R2) + image work.
# OPcache/JIT/pcntl dropped — those were only needed for Octane worker mode.
RUN apt-get update && apt-get install -y \
        git unzip libonig-dev libzip-dev libpng-dev libicu-dev \
    && docker-php-ext-install pdo pdo_mysql bcmath intl zip gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# Full composer install (no committed composer.lock). With laravel/octane
# now removed from composer.json, this resolves a smaller dependency tree
# than the Octane image — the build is also a touch faster.
#
# --no-plugins suppresses the "Composer plugins disabled" warning in
# non-interactive root-user installs (we have no plugins anyway).
# COMPOSER_ALLOW_SUPERUSER=1 silences the root-user warning.
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer update --no-dev --optimize-autoloader --no-interaction --no-scripts --no-plugins \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Pre-build the route/event/view caches so the per-request bootstrap
# at runtime is as fast as possible under artisan serve.
# config:cache is deliberately NOT run here — Railway injects env vars
# (DB_HOST, DB_PASSWORD, etc.) at RUNTIME, not build time, so caching
# config at build snapshots the fallback defaults from config/*.php
# (DB_HOST=127.0.0.1 etc.) and the runtime env vars get ignored.
# Config cache moved to runtime in the CMD below.
RUN php artisan route:cache \
    && php artisan event:cache \
    && php artisan view:cache

EXPOSE ${PORT:-8080}

# Container start:
#   - recreate storage dirs (idempotent — only matters when a Railway
#     Volume is mounted over /app/storage)
#   - re-link public storage symlink
#   - run pending migrations  (with MySQL-ready retry — see below)
#   - run demo seeder (legacy from initial setup; idempotent in
#     practice — DemoSeeder handles duplicate inserts)
#   - hand off to artisan serve
#
# MySQL-ready retry wrapper around `migrate`: at container boot the
# PHP process can arrive at the migrate step a fraction of a second
# earlier than Railway's internal MySQL DNS is resolvable from this
# container's network namespace. Retry up to 10 times at 3-second
# intervals — covers any plausible MySQL startup window.
CMD mkdir -p /app/storage/app/public/tongue /app/storage/app/public/chat /app/storage/app/public/medical-docs /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs \
    && chmod -R 775 /app/storage 2>/dev/null || true; \
    php artisan storage:link --force 2>/dev/null || true; \
    for i in 1 2 3 4 5 6 7 8 9 10; do \
        php artisan migrate --force && break; \
        echo "MySQL not ready yet (attempt $i/10), retrying in 3s..."; \
        sleep 3; \
    done; \
    php artisan config:cache; \
    php artisan db:seed --force; \
    php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
