// Metro config for Expo. Enables package "exports" resolution so the
// `spacetimedb` SDK resolves a browser/RN-compatible build, and prefers
// react-native/browser condition names.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "browser", "require", "import"];

module.exports = config;
