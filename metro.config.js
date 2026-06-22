const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Async route chunks on web can bundle their own React/context copies.
// Force a single module instance for core React packages.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.join(projectRoot, "node_modules/react"),
  "react-dom": path.join(projectRoot, "node_modules/react-dom"),
  "react/jsx-runtime": path.join(projectRoot, "node_modules/react/jsx-runtime"),
  "react/jsx-dev-runtime": path.join(projectRoot, "node_modules/react/jsx-dev-runtime"),
};

module.exports = config;
