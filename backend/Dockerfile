FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    git unzip libonig-dev libzip-dev libpng-dev libicu-dev \
    && docker-php-ext-install pdo pdo_mysql bcmath intl zip gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE ${PORT:-8080}

# mkdir -p on boot: when a Railway Volume is mounted at /app/storage
# (or a sub-path like /app/storage/app/public) the mount starts empty,
# so Laravel's expected directory tree must be recreated every start.
# Idempotent when no volume is attached.
CMD mkdir -p /app/storage/app/public/tongue /app/storage/app/public/chat /app/storage/app/public/medical-docs /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs \
    && chmod -R 775 /app/storage 2>/dev/null || true; \
    php artisan storage:link --force 2>/dev/null || true; \
    php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
