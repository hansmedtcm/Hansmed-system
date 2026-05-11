# HansMed backend Dockerfile.
#
# 2026-05-11 — migrated from `php artisan serve` (single-threaded
# development server, no OPcache, ~5-8s per request) to Laravel
# Octane on FrankenPHP (persistent worker mode, ~100-300ms per
# request). Mirror image of backend/nixpacks.toml — Railway picks
# this file as the build source when both exist, so keeping the two
# in sync is essential.
#
# See backend/config/octane.php for the runtime config.

FROM php:8.3-cli

# System packages + PHP extensions, including opcache (NEW —
# needed for the FrankenPHP worker mode's bytecode cache).
RUN apt-get update && apt-get install -y \
        git unzip wget libonig-dev libzip-dev libpng-dev libicu-dev \
    && docker-php-ext-install pdo pdo_mysql bcmath intl zip gd opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# OPcache + JIT config — drop into the conf.d directory the docker
# PHP image scans on startup. opcache.enable_cli=1 is the critical
# bit; without it, every CLI invocation re-tokenizes the whole
# Laravel autoload tree (the original cause of 4-8s requests).
RUN { \
        echo 'opcache.enable=1'; \
        echo 'opcache.enable_cli=1'; \
        echo 'opcache.memory_consumption=256'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.validate_timestamps=0'; \
        echo 'opcache.jit_buffer_size=256M'; \
        echo 'opcache.jit=tracing'; \
        echo 'realpath_cache_size=4096K'; \
        echo 'realpath_cache_ttl=600'; \
    } > /usr/local/etc/php/conf.d/zz-opcache.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

# `composer update` (full, not partial): the repo has historically
# never committed a composer.lock file, so `composer update <pkg>`
# fails with "Cannot update only a partial set of packages without
# a lock file present" (caught in the first Octane deploy attempt
# 2026-05-11). A full update resolves composer.json fresh, generates
# the lockfile, and installs laravel/octane along with everything
# else. Version constraints in composer.json (^11.0, ^4.0 etc.) keep
# this from pulling in unexpected major-version drift.
#
# --no-plugins suppresses the "Composer plugins disabled" warning
# in non-interactive root-user installs (we have no plugins anyway).
# COMPOSER_ALLOW_SUPERUSER=1 silences the root-user warning that
# Composer otherwise prints to stderr (the image runs as root).
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer update --no-dev --optimize-autoloader --no-interaction --no-scripts --no-plugins \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# FrankenPHP static binary — single file, no deps. v1.4.2 pinned to
# match Laravel Octane ^2.5 compatibility. Bump in lockstep with octane.
RUN wget -q https://github.com/dunglas/frankenphp/releases/download/v1.4.2/frankenphp-linux-x86_64 -O /usr/local/bin/frankenphp \
    && chmod +x /usr/local/bin/frankenphp

# Pre-build Laravel caches so the workers don't have to do it on first
# request. Each `artisan ... cache` shaves milliseconds off boot.
RUN php artisan config:cache \
    && php artisan route:cache \
    && php artisan event:cache \
    && php artisan view:cache

EXPOSE ${PORT:-8080}

# Container start:
#   - recreate storage dirs (idempotent — only matters when a Railway
#     Volume is mounted over /app/storage)
#   - re-link public storage symlink
#   - run pending migrations
#   - run demo seeder (legacy from initial setup; idempotent in
#     practice — DemoSeeder handles duplicate inserts)
#   - hand off to Octane on FrankenPHP
#
# --workers=auto lets FrankenPHP pick worker count from vCPU count.
# --max-requests=500 cycles each worker after 500 requests as a
# defensive measure against any long-tail memory leaks.
CMD mkdir -p /app/storage/app/public/tongue /app/storage/app/public/chat /app/storage/app/public/medical-docs /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs \
    && chmod -R 775 /app/storage 2>/dev/null || true; \
    php artisan storage:link --force 2>/dev/null || true; \
    php artisan migrate --force && php artisan db:seed --force && php artisan octane:start --server=frankenphp --host=0.0.0.0 --port=${PORT:-8080} --workers=auto --max-requests=500
