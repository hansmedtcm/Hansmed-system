#!/bin/bash
set -e

echo "=== HansMed Backend Starting ==="

# Wait for MySQL to be ready
echo "Waiting for MySQL..."
for i in $(seq 1 30); do
  if mysqladmin ping -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" --silent 2>/dev/null; then
    echo "MySQL is ready!"
    break
  fi
  echo "  attempt $i/30..."
  sleep 2
done

# Import schema if tables don't exist
TABLE_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_DATABASE';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -lt "5" ]; then
  echo "Creating database tables..."
  if [ -f /app/database/schema.sql ]; then
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" < /app/database/schema.sql
    echo "Schema imported!"
  fi
fi

# Seed demo data if users table is empty
USER_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" -N -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
  echo "Seeding demo data..."
  php artisan db:seed --force 2>/dev/null || echo "Seeding skipped (will retry on next restart)"
fi

echo "Starting server on port ${PORT:-8080}..."
php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
