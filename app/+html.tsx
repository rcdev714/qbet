import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

import { Colors } from "@/constants/theme";
import {
  APP_URL as BRAND_APP_URL,
  BRAND_NAME,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
} from "@/lib/brand";
import { THEME_MODE_KEY } from "@/lib/theme-preference";

const lightBackground = Colors.light.background;
const darkBackground = Colors.dark.background;
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || BRAND_APP_URL).replace(
  /\/$/,
  "",
);
const DEFAULT_TITLE = DEFAULT_SEO_TITLE;
const DEFAULT_DESCRIPTION = DEFAULT_SEO_DESCRIPTION;
const DEFAULT_IMAGE = `${APP_URL}/og-image.png`;

const themeBootstrapScript = `
(function () {
  var key = ${JSON.stringify(THEME_MODE_KEY)};
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
})();
`.trim();

const responsiveBackground = `
html[data-theme="light"] body {
  background-color: ${lightBackground};
}
html[data-theme="dark"] body {
  background-color: ${darkBackground};
}
`.trim();

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content={darkBackground} media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content={lightBackground} media="(prefers-color-scheme: light)" />
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={BRAND_NAME} />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
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
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
