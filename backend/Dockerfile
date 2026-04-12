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

CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
