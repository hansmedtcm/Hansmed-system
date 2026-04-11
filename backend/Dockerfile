FROM php:8.3-cli

# Install extensions
RUN apt-get update && apt-get install -y \
    git unzip libonig-dev libzip-dev libpng-dev libicu-dev default-mysql-client \
    && docker-php-ext-install pdo pdo_mysql bcmath intl zip gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && php artisan config:cache \
    && php artisan route:cache

EXPOSE 8080

CMD php artisan migrate --force && php artisan db:seed --force && php artisan serve --host=0.0.0.0 --port=8080
