import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const SITE_NAME = "AnyMarket";
const APP_SCHEME = "qbet";
const IOS_APP_STORE_URL = "https://apps.apple.com/app/qbet/id123456789";
const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.rcdev714.qbet";
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || process.env.APP_URL ||
  "https://anymarket.expo.app").replace(/\/$/, "");
const DEFAULT_OG_IMAGE = `${APP_URL}/og-image.png`;

type SupabaseServerClient = ReturnType<typeof createClient<Database>>;

type PreviewOption = {
  id: string;
  label: string;
  yes_pool: number | null;
  no_pool: number | null;
  total_pool: number | null;
};

type PreviewMarket = {
  id: string;
  question: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_public: boolean | null;
  group_id: string | null;
  options?: PreviewOption[];
};

type PreviewGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  share_code: string | null;
};

export type SharePreview = {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonicalUrl: string;
  deepLink: string;
  appUrl: string;
  eyebrow: string;
  primaryLabel: string;
  poolLabel: string | null;
  memberLabel: string | null;
  inviteCode: string | null;
};

function getServerSupabase(): SupabaseServerClient {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server credentials for share preview rendering.",
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function absoluteUrl(value: string | null | undefined) {
  if (!value) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;
  return `${APP_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function imageMimeType(value: string) {
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

function moneyLabel(value: number) {
  if (value <= 0) return null;
  return `$${Math.round(value).toLocaleString()} pool`;
}

function totalPool(options: PreviewOption[] | null | undefined) {
  return (options ?? []).reduce((sum, option) => {
    return sum + Number(option.yes_pool ?? option.total_pool ?? 0) +
      Number(option.no_pool ?? 0);
  }, 0);
}

function leadingPredictions(options: PreviewOption[] | null | undefined) {
  const pool = totalPool(options);
  if (!pool) return null;

  return (options ?? [])
    .map((option) => {
      const optionPool = Number(option.yes_pool ?? option.total_pool ?? 0) +
        Number(option.no_pool ?? 0);
      return {
        label: option.label,
        percentage: Math.round((optionPool / pool) * 100),
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2)
    .map((option) => `${option.label} ${option.percentage}%`)
    .join(" · ");
}

async function fetchGroup(
  supabase: SupabaseServerClient,
  groupId: string | null | undefined,
) {
  if (!groupId) return null;

  const { data } = await supabase
    .from("groups")
    .select("id,name,description,avatar_url,share_code")
    .eq("id", groupId)
    .maybeSingle();

  return (data as PreviewGroup | null) ?? null;
}

async function fetchMemberCount(
  supabase: SupabaseServerClient,
  groupId: string | null | undefined,
) {
  if (!groupId) return 0;

  const { count } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  return count ?? 0;
}

async function fetchGroupPool(
  supabase: SupabaseServerClient,
  groupId: string | null | undefined,
) {
  if (!groupId) return 0;

  const { data } = await supabase
    .from("markets")
    .select("id,options(id,label,yes_pool,no_pool,total_pool)")
    .eq("group_id", groupId);

  return ((data as { options?: PreviewOption[] | null }[] | null) ?? [])
    .reduce((sum, market) => sum + totalPool(market.options), 0);
}

async function fetchMarket(
  supabase: SupabaseServerClient,
  marketId: string,
) {
  const { data } = await supabase
    .from("markets")
    .select(
      "id,question,description,image_url,category,is_public,group_id,options(id,label,yes_pool,no_pool,total_pool)",
    )
    .eq("id", marketId)
    .maybeSingle();

  return (data as PreviewMarket | null) ?? null;
}

function joinDescription(parts: (string | null | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

export async function getMarketSharePreview(
  marketId: string,
  groupId?: string | null,
): Promise<SharePreview> {
  const supabase = getServerSupabase();
  const market = await fetchMarket(supabase, marketId);
  const resolvedGroupId = groupId || market?.group_id || null;
  const [group, memberCount] = await Promise.all([
    fetchGroup(supabase, resolvedGroupId),
    fetchMemberCount(supabase, resolvedGroupId),
  ]);
  const predictions = leadingPredictions(market?.options);
  const pool = totalPool(market?.options);
  const inviteCode = group?.share_code ?? null;
  const canonicalUrl = `${APP_URL}/share/market/${encodeURIComponent(marketId)}${
    resolvedGroupId ? `?group=${encodeURIComponent(resolvedGroupId)}` : ""
  }${inviteCode ? `${resolvedGroupId ? "&" : "?"}invite=${encodeURIComponent(inviteCode)}` : ""}`;
  const question = market?.question || "Predict the futures with friends";
  const groupSuffix = group ? ` in ${group.name}` : "";

  return {
    title: `${question}${groupSuffix}`,
    description: joinDescription([
      predictions ? `Current predictions: ${predictions}.` : null,
      memberCount ? `${memberCount.toLocaleString()} members.` : null,
      moneyLabel(pool),
      inviteCode ? `Invite code: ${inviteCode}.` : null,
      market?.description || group?.description ||
      "Open this AnyMarket prediction with friends.",
    ]),
    imageUrl: absoluteUrl(group?.avatar_url || market?.image_url),
    imageAlt: group
      ? `${group.name} group prediction preview`
      : `${SITE_NAME} prediction market preview`,
    canonicalUrl,
    deepLink: `${APP_SCHEME}://market/${encodeURIComponent(marketId)}${
      resolvedGroupId ? `?group=${encodeURIComponent(resolvedGroupId)}` : ""
    }`,
    appUrl: `${APP_URL}/market/${encodeURIComponent(marketId)}`,
    eyebrow: group?.name || market?.category || "Prediction",
    primaryLabel: question,
    poolLabel: moneyLabel(pool),
    memberLabel: memberCount
      ? `${memberCount.toLocaleString()} member${memberCount === 1 ? "" : "s"}`
      : null,
    inviteCode,
  };
}

export async function getGroupSharePreview(
  groupId: string,
): Promise<SharePreview> {
  const supabase = getServerSupabase();
  const [group, memberCount, pool] = await Promise.all([
    fetchGroup(supabase, groupId),
    fetchMemberCount(supabase, groupId),
    fetchGroupPool(supabase, groupId),
  ]);
  const inviteCode = group?.share_code ?? null;
  const groupName = group?.name || "AnyMarket group";
  const canonicalUrl = `${APP_URL}/share/group/${encodeURIComponent(groupId)}${
    inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : ""
  }`;

  return {
    title: `Join ${groupName} on ${SITE_NAME}`,
    description: joinDescription([
      memberCount ? `${memberCount.toLocaleString()} members.` : null,
      moneyLabel(pool),
      inviteCode ? `Invite code: ${inviteCode}.` : null,
      group?.description || "Join this AnyMarket group and predict with friends.",
    ]),
    imageUrl: absoluteUrl(group?.avatar_url),
    imageAlt: `${groupName} group invite preview`,
    canonicalUrl,
    deepLink: `${APP_SCHEME}://group/${encodeURIComponent(groupId)}`,
    appUrl: `${APP_URL}/group/${encodeURIComponent(groupId)}`,
    eyebrow: "Group invite",
    primaryLabel: groupName,
    poolLabel: moneyLabel(pool),
    memberLabel: memberCount
      ? `${memberCount.toLocaleString()} member${memberCount === 1 ? "" : "s"}`
      : null,
    inviteCode,
  };
}

function escapeHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderSharePreviewHTML(preview: SharePreview) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const imageUrl = escapeHtml(preview.imageUrl);
  const imageAlt = escapeHtml(preview.imageAlt);
  const canonicalUrl = escapeHtml(preview.canonicalUrl);
  const deepLink = escapeHtml(preview.deepLink);
  const appUrl = escapeHtml(preview.appUrl);
  const eyebrow = escapeHtml(preview.eyebrow);
  const primaryLabel = escapeHtml(preview.primaryLabel);
  const poolLabel = escapeHtml(preview.poolLabel);
  const memberLabel = escapeHtml(preview.memberLabel);
  const inviteCode = escapeHtml(preview.inviteCode);
  const imageType = imageMimeType(preview.imageUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${SITE_NAME}</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#1A2F5C">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${canonicalUrl}">
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
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${title} | ${SITE_NAME}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:src" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${imageAlt}">
  <meta property="al:ios:url" content="${deepLink}">
  <meta property="al:ios:app_store_id" content="123456789">
  <meta property="al:ios:app_name" content="${SITE_NAME}">
  <meta property="al:android:url" content="${deepLink}">
  <meta property="al:android:package" content="com.rcdev714.qbet">
  <meta property="al:android:app_name" content="${SITE_NAME}">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: radial-gradient(circle at top, #2A5BFF 0%, #1A2F5C 42%, #0F1F3D 100%);
      color: #1A2F5C;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .card {
      width: min(100%, 480px);
      overflow: hidden;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 20px 60px rgba(8, 19, 43, 0.32);
    }
    .image {
      display: block;
      width: 100%;
      height: 240px;
      object-fit: cover;
      background: #EEF4FF;
    }
    .body { padding: 28px; }
    .brand {
      margin-bottom: 18px;
      color: rgba(26, 47, 92, 0.58);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 16px;
      color: #1A2F5C;
      font-size: 30px;
      line-height: 1.12;
    }
    p {
      margin: 0 0 22px;
      color: rgba(26, 47, 92, 0.72);
      font-size: 16px;
      line-height: 1.5;
    }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
    .pill {
      border: 1px solid rgba(42, 91, 255, 0.18);
      border-radius: 999px;
      background: rgba(42, 91, 255, 0.1);
      color: #2A5BFF;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
    }
    .cta {
      display: block;
      border-radius: 999px;
      background: #1A2F5C;
      color: white;
      padding: 16px 20px;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
    }
    .secondary {
      margin-top: 12px;
      background: rgba(42, 91, 255, 0.12);
      color: #1A2F5C;
    }
  </style>
</head>
<body>
  <main class="card">
    <img class="image" src="${imageUrl}" alt="${imageAlt}">
    <section class="body">
      <div class="brand">${eyebrow} · ${SITE_NAME}</div>
      <h1>${primaryLabel}</h1>
      <p>${description}</p>
      <div class="stats">
        ${memberLabel ? `<span class="pill">${memberLabel}</span>` : ""}
        ${poolLabel ? `<span class="pill">${poolLabel}</span>` : ""}
        ${inviteCode ? `<span class="pill">Invite ${inviteCode}</span>` : ""}
      </div>
      <a class="cta" href="${deepLink}">Open in ${SITE_NAME}</a>
      <a class="cta secondary" href="${appUrl}">Continue on web</a>
    </section>
  </main>
</body>
</html>`;
}

export function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
