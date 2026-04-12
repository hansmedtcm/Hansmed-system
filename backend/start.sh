#!/bin/bash
set -e

echo "=== HansMed Backend Starting ==="

MYSQL_CMD="mysql --ssl-mode=DISABLED -h$DB_HOST -P$DB_PORT -u$DB_USERNAME -p$DB_PASSWORD"

echo "Waiting for MySQL..."
for i in $(seq 1 30); do
  if $MYSQL_CMD -e "SELECT 1;" >/dev/null 2>&1; then
    echo "MySQL is ready!"
    break
  fi
  echo "  attempt $i/30..."
  sleep 2
done

TABLE_COUNT=$($MYSQL_CMD "$DB_DATABASE" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_DATABASE';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -lt "5" ]; then
  echo "Creating database tables..."
  if [ -f /app/database/schema.sql ]; then
    $MYSQL_CMD "$DB_DATABASE" < /app/database/schema.sql
    echo "Schema imported!"
  fi
fi

USER_COUNT=$($MYSQL_CMD "$DB_DATABASE" -N -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
  echo "Seeding demo data..."
  php artisan db:seed --force 2>/dev/null || echo "Seeding skipped"
fi

echo "Starting server on port ${PORT:-8080}..."
php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
