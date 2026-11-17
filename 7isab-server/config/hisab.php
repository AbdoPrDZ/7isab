<?php

return [

    /*
    | First super admin, created by SuperAdminSeeder.
    */
    'super_admin' => [
        'email' => env('SUPER_ADMIN_EMAIL'),
        'password' => env('SUPER_ADMIN_PASSWORD'),
    ],

    /*
    | Admin panel tokens expire after this many minutes (app tokens don't expire).
    */
    'admin_token_ttl' => (int) env('ADMIN_TOKEN_TTL', 720),

    /*
    | Quran text source (quran.com API v4) and dataset version.
    | Bump the version when re-importing different text, so apps refresh their offline copy.
    */
    'quran' => [
        'source_url' => env('QURAN_SOURCE_URL', 'https://api.quran.com/api/v4'),
        'version' => env('QURAN_DATA_VERSION', 'uthmani-madani-v1'),
    ],

    /*
    | Sync limits.
    */
    'sync' => [
        // Most changes accepted in one push.
        'max_push' => (int) env('SYNC_MAX_PUSH', 500),
        // Most changes returned by one pull.
        'max_pull' => (int) env('SYNC_MAX_PULL', 500),
        // Most payload bytes in one pull page (attachments are split into ~160 KB records).
        'max_pull_bytes' => (int) env('SYNC_MAX_PULL_BYTES', 4 * 1024 * 1024),
    ],

];
