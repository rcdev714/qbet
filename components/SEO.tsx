import Head from 'expo-router/head';
import React from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  keywords?: string;
  noindex?: boolean;
}

const SITE_NAME = 'AnyMarket';
const BRAND_COLOR = '#1A2F5C';
const LIGHT_THEME_COLOR = '#FFFFFF';
const DARK_THEME_COLOR = '#1A2C38';
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://anymarket.expo.app').replace(/\/$/, '');
const DEFAULT_TITLE = 'AnyMarket | Predict the futures with friends';
const DEFAULT_DESCRIPTION = 'AnyMarket is a social prediction market platform where friends create private markets, back predictions, and get rewarded for seeing what comes next.';
const DEFAULT_IMAGE = '/og-image.png';
const DEFAULT_IMAGE_ALT = 'AnyMarket social prediction market preview';
const DEFAULT_KEYWORDS = 'AnyMarket, social prediction market, predict with friends, private prediction markets, future predictions, prediction rewards, group predictions';

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${APP_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function imageMimeType(value: string) {
  const pathname = (() => {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  })().toLowerCase();

  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  return undefined;
}

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  imageAlt = DEFAULT_IMAGE_ALT,
  image = DEFAULT_IMAGE,
  url = APP_URL,
  type = 'website',
  keywords = DEFAULT_KEYWORDS,
  noindex = false,
}: SEOProps) {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | AnyMarket`;
  const canonicalUrl = absoluteUrl(url);
  const imageUrl = absoluteUrl(image);
  const imageType = imageMimeType(imageUrl);
  
  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:url" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {imageType && <meta property="og:image:type" content={imageType} />}
      <meta itemProp="image" content={imageUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:src" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {/* PWA / Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content={BRAND_COLOR} />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content={LIGHT_THEME_COLOR} />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content={DARK_THEME_COLOR} />
      <meta name="color-scheme" content="light dark" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      
      {/* Favicon - Ensure these paths match your actual assets */}
      <link rel="icon" type="image/svg+xml" href="/og-image.svg" />
      <link rel="apple-touch-icon" href="/og-image.png" />
    </Head>
  );
}
