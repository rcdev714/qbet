const { getDefaultConfig } = require("expo/metro-config");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const projectRoot = __dirname;
const defaultConfig = getDefaultConfig(projectRoot);
const config = getSentryExpoConfig(projectRoot, defaultConfig);

// Async route chunks on web can bundle their own React/context copies.
// Force a single module instance for core React packages.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.join(projectRoot, "node_modules/react"),
  "react-dom": path.join(projectRoot, "node_modules/react-dom"),
  "react/jsx-runtime": path.join(projectRoot, "node_modules/react/jsx-runtime"),
  "react/jsx-dev-runtime": path.join(projectRoot, "node_modules/react/jsx-dev-runtime"),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // `ws` is Node-only; used during Expo static export (environment=node), not in browser bundles.
  if (moduleName === "ws" && context.customTransformOptions?.environment !== "node") {
    return { type: "empty" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
