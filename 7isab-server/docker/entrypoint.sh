#!/bin/sh
# Starts the 7isab server: checks the config, migrates and seeds (both safe to
# rerun), caches the config, then runs PHP-FPM behind nginx.
set -e
cd /var/www/html

if [ -z "$APP_KEY" ]; then
  echo "APP_KEY is not set. Run 'php artisan key:generate --show' and put the value in .env." >&2
  exit 1
fi

# The storage volume starts empty on a new server: recreate Laravel's folders.
mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache

php artisan migrate --force
php artisan db:seed --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

php-fpm -D
exec nginx -g 'daemon off;'
