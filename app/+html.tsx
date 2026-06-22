import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

import { Colors } from "@/constants/theme";
import { THEME_MODE_KEY } from "@/lib/theme-preference";

const lightBackground = Colors.light.background;
const darkBackground = Colors.dark.background;
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://anymarket.expo.app")
  .replace(/\/$/, "");
const DEFAULT_TITLE = "AnyMarket | Predict the Future with friends";
const DEFAULT_DESCRIPTION =
  "AnyMarket is a social prediction market platform where friends create private markets, back predictions, and get rewarded for seeing what comes next.";
const DEFAULT_IMAGE = `${APP_URL}/og-image.png`;

const themeBootstrapScript = `
(function () {
  var key = ${JSON.stringify(THEME_MODE_KEY)};
  var light = ${JSON.stringify(lightBackground)};
  var dark = ${JSON.stringify(darkBackground)};
  var mode = "dark";
  try {
    var stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") {
      mode = stored;
    }
  } catch (e) {}

  var prefersDark = false;
  try {
    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (e) {}

  var resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  var bg = resolved === "dark" ? dark : light;
  function applyBodyBackground() {
    if (document.body) {
      document.body.style.backgroundColor = bg;
    }
  }
  applyBodyBackground();
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", applyBodyBackground);
  }
})();
`.trim();

const responsiveBackground = `
body {
  background-color: ${lightBackground};
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: ${darkBackground};
  }
}
`.trim();

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content={darkBackground} media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content={lightBackground} media="(prefers-color-scheme: light)" />
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnyMarket" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content={APP_URL} />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:image" content={DEFAULT_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_IMAGE} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
