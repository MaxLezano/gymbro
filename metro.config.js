// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Gradle writes thousands of intermediate files into android/build and into each
// native module's android/build and .cxx folders (inside node_modules). Watching
// them made Metro hang during native builds, so keep them out of the file map.
const nativeBuildOutputs = /[\\/]android[\\/](?:[^\\/]+[\\/])?(?:build|\.cxx|\.gradle)[\\/].*/;

config.resolver.blockList = [...[config.resolver.blockList].flat().filter(Boolean), nativeBuildOutputs];

module.exports = config;
