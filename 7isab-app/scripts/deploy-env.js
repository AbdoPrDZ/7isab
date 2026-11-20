/**
 * Runs a command with the deploy environment: .env.deploy only. Expo's own
 * .env loading is turned off (EXPO_NO_DOTENV), so nothing from a
 * local setup leaks into a release.
 *
 *   node ./scripts/deploy-env.js <command> [args…]
 *
 * Fails before running anything when .env.deploy is missing or a required
 * variable is empty, so a release can't be built against the wrong server.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY_FILE = path.join(ROOT, '.env.deploy');
const REQUIRED = ['EXPO_PUBLIC_API_URL', 'OTA_SERVER_URL', 'OTA_API_KEY'];

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(DEPLOY_FILE)) {
  fail('.env.deploy not found in 7isab-app/. Copy .env.deploy.example to .env.deploy and fill it in.');
}

const env = {
  ...process.env,
  ...parseEnv(fs.readFileSync(DEPLOY_FILE, 'utf8')),
  EXPO_NO_DOTENV: '1',
};

const missing = REQUIRED.filter((name) => !env[name]?.trim());
if (missing.length) {
  fail(`Missing ${missing.join(', ')} in .env.deploy.`);
}
for (const name of ['EXPO_PUBLIC_API_URL', 'OTA_SERVER_URL']) {
  if (!env[name].startsWith('https://')) fail(`${name} must be an https:// URL for a release (got ${env[name]}).`);
}

const [command, ...args] = process.argv.slice(2);
if (!command) fail('Usage: node ./scripts/deploy-env.js <command> [args…]');

console.log(`Deploy env: API ${env.EXPO_PUBLIC_API_URL} · OTA ${env.OTA_SERVER_URL}`);
const result = spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit' });
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
