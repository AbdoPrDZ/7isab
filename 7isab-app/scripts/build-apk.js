/**
 * Builds the Android release APK and copies it to
 * release/<slug>-<runtimeVersion>-<version>.apk, next to the OTA bundle zip
 * made by `npm run build:release`, ready to upload to OTACenter.
 *
 * Steps: resolve the Expo config (app.json + app.config.js + .env),
 * regenerate android/ with `expo prebuild` so it matches the config (icons,
 * splash, plugins), then run Gradle's assembleRelease.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const RELEASE_DIR = process.env.RELEASE_DIR || path.join(ROOT, 'release');
const APK_OUT = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

function run(command, cwd = ROOT) {
  execSync(command, { cwd, stdio: 'inherit' });
}

// Full path: Windows may not run programs from the current folder.
const GRADLEW = path.join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

/**
 * Stops leftover Gradle daemons (and the Kotlin daemons they started) from an
 * earlier build. On Windows they keep build files open, so prebuild or Gradle
 * fails with "Unable to delete file". Best effort: never fails the build.
 */
function stopGradleDaemons() {
  if (!fs.existsSync(GRADLEW)) return;
  console.log('Stopping running Gradle daemons');
  try {
    run(`"${GRADLEW}" --stop`, ANDROID_DIR);
  } catch {
    console.warn('Could not stop the Gradle daemons; continuing.');
  }
}

function expoConfig() {
  const json = execSync('npx expo config --type public --json', { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(json);
}

function main() {
  const config = expoConfig();
  const { slug, version } = config;
  const runtimeVersion = typeof config.runtimeVersion === 'string' ? config.runtimeVersion : version;

  if (!slug || !version || !runtimeVersion) {
    console.error('slug, version and runtimeVersion must be set in app.json.');
    process.exit(1);
  }

  const apkName = `${slug}-${runtimeVersion}-${version}.apk`;
  console.log(`Building release APK ${apkName}`);

  stopGradleDaemons();
  run(`npx expo prebuild --platform android --no-install`);

  if (fs.existsSync(APK_OUT)) fs.rmSync(APK_OUT);
  try {
    // --no-daemon and in-process Kotlin: nothing keeps running after the build
    // to lock files for the next one.
    run(`"${GRADLEW}" assembleRelease --no-daemon -Pkotlin.compiler.execution.strategy=in-process`, ANDROID_DIR);
  } catch {
    console.error('Gradle assembleRelease failed.');
    process.exit(2);
  }

  if (!fs.existsSync(APK_OUT)) {
    console.error(`APK not found at ${APK_OUT}`);
    process.exit(3);
  }

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const apkPath = path.join(RELEASE_DIR, apkName);
  fs.copyFileSync(APK_OUT, apkPath);
  const sizeMb = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(1);
  console.log(`Release APK created: ${apkPath} (${sizeMb} MB)`);
}

main();
