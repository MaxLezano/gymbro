const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with GymBro's own key so a new APK installs over the
 * previous one (Android only updates in place when the signature matches).
 *
 * The keystore and passwords never live in the repo: they come from Gradle
 * properties (e.g. ~/.gradle/gradle.properties):
 *   GYMBRO_RELEASE_STORE_FILE, GYMBRO_RELEASE_STORE_PASSWORD,
 *   GYMBRO_RELEASE_KEY_ALIAS, GYMBRO_RELEASE_KEY_PASSWORD
 * Without them, release falls back to the debug key (as Expo's template does).
 */
const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('GYMBRO_RELEASE_STORE_FILE')) {
                storeFile file(GYMBRO_RELEASE_STORE_FILE)
                storePassword GYMBRO_RELEASE_STORE_PASSWORD
                keyAlias GYMBRO_RELEASE_KEY_ALIAS
                keyPassword GYMBRO_RELEASE_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('GYMBRO_RELEASE_STORE_FILE')) return mod;

    // 1. Add the release signing config next to the debug one.
    gradle = gradle.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${RELEASE_CONFIG}`);

    // 2. Point the release build type at it when the key is available.
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('GYMBRO_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug"
    );

    if (!gradle.includes('storeFile file(GYMBRO_RELEASE_STORE_FILE)') || !gradle.includes('signingConfigs.release :')) {
      throw new Error('withReleaseSigning: could not find the signing blocks in app/build.gradle');
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
