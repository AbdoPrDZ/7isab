/**
 * Signs in to OTACenter and saves the API token as OTA_TOKEN in .env.deploy,
 * for the `publish:*` and `promote` scripts. Run through deploy-env.js, so
 * OTA_SERVER_URL comes from .env.deploy.
 *
 *   npm run ota:login                 # asks for the login and the password
 *   npm run ota:login -- <login>      # asks only for the password
 *
 * The password is never echoed, passed as an argument or written anywhere.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const DEPLOY_FILE = path.resolve(__dirname, '..', '.env.deploy');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then swallow every echoed character.
      rl._writeToOutput = (text) => {
        if (text.startsWith(question)) rl.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function saveToken(token) {
  const text = fs.readFileSync(DEPLOY_FILE, 'utf8');
  const line = `OTA_TOKEN=${token}`;
  const next = /^OTA_TOKEN=.*$/m.test(text)
    ? text.replace(/^OTA_TOKEN=.*$/m, line)
    : `${text.replace(/\n*$/, '\n')}${line}\n`;
  fs.writeFileSync(DEPLOY_FILE, next);
}

async function main() {
  const server = process.env.OTA_SERVER_URL.replace(/\/+$/, '');
  const login = process.argv[2] || (await ask('OTACenter login: '));
  if (!login) fail('No login given.');
  const password = await ask('Password: ', { hidden: true });
  if (!password) fail('No password given.');

  let response;
  try {
    response = await fetch(`${server}/api/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
  } catch (error) {
    fail(`Cannot reach ${server}: ${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) fail(`Login failed: ${body.message || response.status}`);

  saveToken(body.token);
  console.log(`Signed in to ${server}. OTA_TOKEN saved in .env.deploy.`);
}

main();
