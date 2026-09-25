// Learn more https://docs.expo.dev/guides/customizing-metro
// Sentry's variant of Expo's default config: adds debug ids so uploaded source maps match release bundles.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Gradle writes thousands of intermediate files into android/build and into each
// native module's android/build and .cxx folders (inside node_modules). Watching
// them made Metro hang during native builds, so keep them out of the file map.
const nativeBuildOutputs = /[\\/]android[\\/](?:[^\\/]+[\\/])?(?:build|\.cxx|\.gradle)[\\/].*/;

config.resolver.blockList = [...[config.resolver.blockList].flat().filter(Boolean), nativeBuildOutputs];

module.exports = config;
