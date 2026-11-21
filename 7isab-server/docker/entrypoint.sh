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

# Only the web container migrates; the queue, scheduler and Reverb containers
# set RUN_MIGRATIONS=false so they don't race it.
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  php artisan migrate --force
  php artisan db:seed --force
fi
php artisan config:cache
php artisan route:cache
php artisan view:cache

# A service with its own command (queue worker, scheduler, Reverb) runs that instead of the web server.
# It runs as www-data, like PHP-FPM, so files it writes stay readable by the web server.
if [ "$#" -gt 0 ]; then
  exec su-exec www-data "$@"
fi

php-fpm -D
exec nginx -g 'daemon off;'
