// @ts-nocheck: Deno edge runtime uses remote imports resolved by deno.json.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// App store URLs - replace with actual URLs when published
const IOS_APP_STORE_URL = "https://apps.apple.com/app/qbet/id123456789"; // TODO: Replace with actual App Store URL
const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.rcdev714.qbet";
const APP_SCHEME = "qbet";
const APP_URL = (Deno.env.get("EXPO_PUBLIC_APP_URL") ||
  Deno.env.get("APP_URL") || "https://anymarket.expo.app").replace(/\/$/, "");
const SITE_NAME = "AnyMarket";
const DEFAULT_OG_IMAGE = `${APP_URL}/og-image.png`;

interface MarketOption {
  id: string;
  label: string;
  yes_pool: number | null;
  no_pool: number | null;
  total_pool: number | null;
}

interface MarketData {
  id: string;
  question: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_public: boolean;
  options: MarketOption[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const marketId = url.searchParams.get("market");

    if (!marketId) {
      return new Response("Missing market parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch market data with options for odds
    // Fetch market data with options for odds
    const { data: market, error } = await supabase
      .from("markets")
      .select(
        "id, question, description, image_url, category, is_public, options(id, label, yes_pool, no_pool, total_pool)",
      )
      .eq("id", marketId)
      .single();

    if (error || !market) {
      console.error("Market not found:", marketId, error);
      // Still redirect even if market not found - let app handle the error
    }

    const marketData: MarketData = (market as unknown as MarketData) || {
      id: marketId,
      question: "Predict the Future with friends",
      description:
        "Create private prediction markets with friends and get rewarded for seeing what comes next.",
      image_url: null,
      category: null,
      is_public: true,
      options: [],
    };

    // Calculate odds for display
    let oddsDisplay = "";
    if (
      marketData.is_public && marketData.options &&
      marketData.options.length > 0
    ) {
      const totalPool = marketData.options.reduce(
        (sum: number, opt: MarketOption) => {
          return sum + Number(opt.yes_pool || 0) + Number(opt.no_pool || 0) +
            Number(opt.total_pool || 0);
        },
        0,
      );

      if (totalPool > 0) {
        // Sort options by probability
        const opts = marketData.options.map((opt: MarketOption) => {
          const pool = Number(opt.yes_pool || opt.total_pool || 0) +
            Number(opt.no_pool || 0);
          const prob = pool / totalPool;
          return { label: opt.label, prob };
        }).sort((a: { prob: number }, b: { prob: number }) => b.prob - a.prob);

        if (
          opts.length === 2 &&
          (opts[0].label === "Yes" || opts[0].label === "No")
        ) {
          // Binary
          const yes = opts.find((o: { label: string }) => o.label === "Yes");
          const percent = Math.round((yes?.prob || 0.5) * 100);
          oddsDisplay = `Yes ${percent}% · No ${100 - percent}%`;
        } else {
          // Multi
          opts.slice(0, 2).forEach(
            (o: { label: string; prob: number }, i: number) => {
              oddsDisplay += `${o.label} ${Math.round(o.prob * 100)}%${
                i < Math.min(opts.length, 2) - 1 ? " · " : ""
              }`;
            },
          );
        }
      }
    }

    // Detect user agent
    const userAgent = req.headers.get("user-agent") || "";
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);

    // Deep link URL
    const groupId = url.searchParams.get("group");
    const canonicalUrl = `${APP_URL}/share/market/${encodeURIComponent(marketId)}${
      groupId ? `?group=${encodeURIComponent(groupId)}` : ""
    }`;
    const deepLink = `${APP_SCHEME}://market/${marketId}${
      groupId ? `?group=${groupId}` : ""
    }`;

    // Fallback store URL
    const storeUrl = isIOS
      ? IOS_APP_STORE_URL
      : isAndroid
      ? ANDROID_PLAY_STORE_URL
      : IOS_APP_STORE_URL; // Default to iOS for desktop

    // Generate HTML with Open Graph tags and smart redirect
    const html = generateRedirectHTML(
      marketData,
      oddsDisplay,
      deepLink,
      storeUrl,
      canonicalUrl,
      isIOS,
      isAndroid,
    );

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error in share-redirect:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function generateRedirectHTML(
  market: MarketData,
  odds: string,
  deepLink: string,
  storeUrl: string,
  canonicalUrl: string,
  isIOS: boolean,
  isAndroid: boolean,
): string {
  // Escape HTML to prevent XSS
  const escapeHtml = (str: string | null) => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const title = escapeHtml(market.question) ||
    "AnyMarket | Predict the Future with friends";
  const rawDesc = market.description ||
    "Predict future outcomes with friends on AnyMarket.";
  // Only show odds if public
  const description = `${
    odds && market.is_public ? `Current predictions: ${odds}. ` : ""
  }${escapeHtml(rawDesc)}`;
  const imageUrl = escapeHtml(market.image_url || DEFAULT_OG_IMAGE);
  const imageAlt = `${SITE_NAME} prediction market preview`;
  const category = escapeHtml(market.category) || "Prediction";
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const imageType = imageMimeType(market.image_url || DEFAULT_OG_IMAGE);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${SITE_NAME}</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#1A2F5C">
  <link rel="canonical" href="${safeCanonicalUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeCanonicalUrl}">
  <meta property="og:title" content="${title} | ${SITE_NAME}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:url" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:alt" content="${imageAlt}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  ${imageType ? `<meta property="og:image:type" content="${imageType}">` : ""}
  <meta itemprop="image" content="${imageUrl}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} | ${SITE_NAME}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:src" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${imageAlt}">
  
  <!-- App Links (for Facebook/Instagram) -->
  <meta property="al:ios:url" content="${deepLink}">
  <meta property="al:ios:app_store_id" content="123456789">
  <meta property="al:ios:app_name" content="${SITE_NAME}">
  <meta property="al:android:url" content="${deepLink}">
  <meta property="al:android:package" content="com.rcdev714.qbet">
  <meta property="al:android:app_name" content="${SITE_NAME}">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0F1F3D;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .background {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at top, #2A5BFF 0%, #1A2F5C 42%, #0F1F3D 100%);
        z-index: -1;
    }
    .container {
      text-align: center;
      max-width: 480px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 24px;
      padding: 40px 24px;
      box-shadow: 0 16px 48px rgba(8, 19, 43, 0.28);
    }
    .logo {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
      margin-bottom: 32px;
      color: #1A2F5C;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .logo-badge {
        background: #2A5BFF;
        color: #fff;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .market-card {
        margin-bottom: 32px;
    }
    .category {
      display: inline-block;
      color: rgba(26, 47, 92, 0.62);
      font-size: 12px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .question {
      font-size: 28px;
      font-weight: 400;
      line-height: 1.2;
      margin-bottom: 16px;
      color: #1A2F5C;
    }
    .odds-badge {
        display: inline-block;
        background: rgba(42, 91, 255, 0.12);
        border: 1px solid rgba(42, 91, 255, 0.24);
        color: #2A5BFF;
        padding: 8px 16px;
        border-radius: 100px;
        font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 24px;
    }
    .market-image {
        width: 100%;
        height: 200px;
        object-fit: cover;
        border-radius: 16px;
        margin-bottom: 24px;
        background: #EEF4FF;
        display: block;
    }
    .cta-btn {
      display: block;
      background: #1A2F5C;
      color: #fff;
      padding: 16px 24px;
      border-radius: 100px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.2s;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(26, 47, 92, 0.24);
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(26, 47, 92, 0.32);
    }
    .secondary-link {
        color: rgba(26, 47, 92, 0.5);
        font-size: 14px;
        text-decoration: none;
        transition: color 0.2s;
        margin-top: 24px;
        display: inline-block;
    }
    .secondary-link:hover {
        color: #1A2F5C;
    }
    .footer {
        margin-top: 32px;
        font-size: 12px;
        color: rgba(26, 47, 92, 0.45);
    }
  </style>
</head>
<body>
  <div class="background"></div>
  <div class="container">
    <div class="logo">
        AnyMarket
        <span class="logo-badge">Beta</span>
    </div>
    
    <div class="market-card">
        ${category ? `<div class="category">${category}</div>` : ""}
        <img src="${imageUrl}" class="market-image" alt="${imageAlt}" />
        <h1 class="question">${title}</h1>
        ${odds ? `<div class="odds-badge">${odds}</div>` : ""}
    </div>
    
    <a href="${deepLink}" class="cta-btn">Open in AnyMarket</a>
    <a href="${safeCanonicalUrl}" class="cta-btn" style="background: rgba(42,91,255,0.12); color:#1A2F5C; box-shadow:none;">
        Continue to AnyMarket
    </a>
    
    <div class="footer">
        Predict the Future with friends
    </div>
  </div>

  <script>
    // Simple redirect logic
    setTimeout(function() {
      document.location.href = "${deepLink}"; 
    }, 1000);
    setTimeout(function() {
      document.location.href = "${safeCanonicalUrl}";
    }, 1800);
  </script>
</body>
</html>`;
}

function imageMimeType(value: string | null) {
  if (!value) return null;
  const pathname = (() => {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  })().toLowerCase();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  return null;
}
