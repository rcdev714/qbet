import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildWelcomeEmail(params: { username: string | null; appUrl: string }) {
  const greeting = params.username ? `Hi @${params.username},` : "Hi there,";
  const bodyHtml = `<p>${greeting}</p>
<p>Welcome to <strong>AnyMarket</strong> — predict outcomes, bet with friends, and track your wins.</p>
<p>Explore public markets, join private groups, and follow other predictors to stay in the loop.</p>`;

  const html = buildEmailLayout({
    title: "Welcome to AnyMarket",
    bodyHtml,
    ctaLabel: "Open AnyMarket",
    ctaUrl: params.appUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${greeting}\n\nWelcome to AnyMarket. Explore markets, join groups, and follow other predictors.`,
    ctaUrl: params.appUrl,
    appUrl: params.appUrl,
  });

  return {
    subject: "Welcome to AnyMarket",
    html,
    text,
    idempotencyKey: `welcome/${params.username ?? "user"}`,
  };
}
