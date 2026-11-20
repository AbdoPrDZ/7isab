/**
 * Extends app.json: bundles every athan recording in assets/athan as a
 * notification sound, adds the location and exact-alarm permissions the
 * prayer times need, and the OTA plugin when its environment variables are set. The list of bundled files is passed to the app as
 * `extra.athanSounds`.
 *
 * Android keeps sounds as raw resources, so file names may only use
 * lowercase letters, digits and "_" (e.g. makkah.mp3, fajr_madinah.mp3).
 */
const fs = require('node:fs');
const path = require('node:path');

const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const ATHAN_DIR = path.join(__dirname, 'assets', 'athan');
const SOUND_FILE = /\.(mp3|wav|ogg)$/i;
const VALID_NAME = /^[a-z][a-z0-9_]*\.(mp3|wav|ogg)$/;

/**
 * Local Android build settings that must survive `expo prebuild --clean`:
 * only arm64 phones (faster build, smaller APK) and at most 4 Gradle workers,
 * so a build doesn't run Windows out of memory.
 */
const GRADLE_PROPERTIES = {
  reactNativeArchitectures: 'arm64-v8a',
  'org.gradle.workers.max': '4',
};

/**
 * CMake 3.22.1 (the default) ships ninja 1.10, which fails on Windows object
 * paths over 260 characters (react-native-gesture-handler hits this). 3.31.6
 * ships ninja 1.12, which handles long paths. It must be installed in the SDK.
 */
const CMAKE_VERSION = '3.31.6';
const CMAKE_MARKER = '// @7isab cmake-version';

function withBuildSettings(config) {
  config = withGradleProperties(config, (mod) => {
    for (const [key, value] of Object.entries(GRADLE_PROPERTIES)) {
      mod.modResults = mod.modResults.filter((item) => !(item.type === 'property' && item.key === key));
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(CMAKE_MARKER)) return mod;
    const anchor = /^android \{\n/m;
    if (!anchor.test(mod.modResults.contents)) {
      throw new Error('withBuildSettings: no `android {` block in app/build.gradle to set the CMake version.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      (match) =>
        `${match}    ${CMAKE_MARKER}\n    externalNativeBuild {\n        cmake {\n            version "${CMAKE_VERSION}"\n        }\n    }\n\n`,
    );
    return mod;
  });
}

/**
 * Over-the-air updates: the server and its key come from environment
 * variables (.env, never committed). Without them the plugin is left
 * out and the app builds without OTA.
 */
function otaPlugin() {
  const serverUrl = process.env.OTA_SERVER_URL;
  const apiKey = process.env.OTA_API_KEY;
  return serverUrl && apiKey ? [['expo-ota-client', { serverUrl, apiKey }]] : [];
}

/** @returns {string[]} */
function athanFiles() {
  if (!fs.existsSync(ATHAN_DIR)) return [];
  const files = fs.readdirSync(ATHAN_DIR).filter((file) => SOUND_FILE.test(file));
  const invalid = files.filter((file) => !VALID_NAME.test(file));
  if (invalid.length) {
    throw new Error(
      `assets/athan: rename ${invalid.join(', ')}. Use only lowercase letters, digits and "_" (e.g. makkah.mp3).`,
    );
  }
  return files.sort();
}

/** @param {import('expo/config').ConfigContext} context @returns {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const sounds = athanFiles();
  const permissions = new Set([...(config.android?.permissions ?? []), 'android.permission.SCHEDULE_EXACT_ALARM']);

  return withBuildSettings({
    ...config,
    name: config.name ?? '7isab-app',
    slug: config.slug ?? '7isab-app',
    android: { ...config.android, permissions: [...permissions] },
    plugins: [
      ...(config.plugins ?? []),
      ...otaPlugin(),
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Your location is used on this phone only, to calculate prayer times and the qibla.',
        },
      ],
      ['expo-notifications', { sounds: sounds.map((file) => `./assets/athan/${file}`) }],
    ],
    extra: { ...config.extra, athanSounds: sounds },
  });
};
