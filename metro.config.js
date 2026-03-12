const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\.cache\/openid-client\/.*/,
  /node_modules\/expo-secure-store.*_tmp.*/,
];

module.exports = config;
