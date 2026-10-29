const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-notifications-client is the parent folder: resolve it from there (its `react-native` entry is src/index.ts),
// and hide the parent's dev node_modules so react-native, expo-notifications, ... come from this app only.
const root = path.resolve(__dirname, '..');
const escape = (p) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

config.watchFolders = [root];
config.resolver.extraNodeModules = { 'expo-notifications-client': root };
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escape(path.join(root, 'node_modules'))}/.*`),
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
