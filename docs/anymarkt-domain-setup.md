# Anymarkt domain setup (Cloudflare + EAS + Supabase + Resend)

Checklist for attaching **https://anymarkt.com** to the Expo EAS-hosted web app and migrating email to `@anymarkt.com`.

**Canonical URL:** `https://anymarkt.com` (apex)  
**Deploy target:** Expo EAS Hosting for production today. Vite on Vercel is the cutover target — see [vercel-web-cutover.md](./vercel-web-cutover.md).

---

## 1. Cloudflare DNS (web → EAS)

1. Add `anymarkt.com` to Cloudflare (nameservers at registrar if needed).
2. Expo dashboard → [Hosting → Custom domains](https://expo.dev/projects/5f9fbca3-cb6b-4b24-8918-2717c150019b/hosting) → Add `anymarkt.com`.
3. Copy DNS records from Expo into Cloudflare:
   - `@` → EAS-provided target (**DNS only**, grey cloud)
   - `www` → CNAME to apex or separate EAS record
4. Cloudflare **Redirect Rule:** `www.anymarkt.com/*` → `https://anymarkt.com/$1` (301)
5. Wait for EAS SSL provisioning (dashboard shows active).

## 2. Cloudflare DNS (email → Resend)

1. Resend → **Domains** → Add `anymarkt.com`.
2. Add records Resend provides in Cloudflare:
   - DKIM (TXT/CNAME)
   - SPF (TXT on `@`) — use exact value from Resend
   - DMARC (TXT on `_dmarc`): `v=DMARC1; p=none; rua=mailto:dmarc@anymarkt.com`
3. Verify domain in Resend before updating Supabase secrets.

## 3. Expo EAS

**Environment variables** (expo.dev → project → Environment variables → **production**):

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_APP_URL` | `https://anymarkt.com` |

**Deploy:**

```bash
npm run predeploy:prod
npm run deploy:web:prod
```

**Project slug:** Update Expo dashboard slug from `anymarket` → `anymarkt` (matches `app.json`).

**Legacy redirect:** EAS Hosting → configure `anymarket.expo.app` → `https://anymarkt.com` (301).

## 4. Supabase (`jweyqlcvvmdyyqgqcsjd`)

**Dashboard → Authentication → URL Configuration:**

- Site URL: `https://anymarkt.com`
- Redirect URLs: `https://anymarkt.com/**`, `https://www.anymarkt.com/**`, `http://localhost:8081/**`, `qbet://**`

**Secrets:**

```bash
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarkt.com
npx supabase secrets set RESEND_FROM_EMAIL="Anymarkt <onboarding@anymarkt.com>"
npx supabase secrets set WEB_PUSH_SUBJECT=mailto:support@anymarkt.com
```

Redeploy edge functions after secrets change (see `scripts/deploy-production.sh`).

## 5. Stripe & MoonPay

- **Stripe Connect** business profile URL → `https://anymarkt.com`
- **MoonPay** dashboard: allow `https://anymarkt.com/wallet?moonpay=return*`
- Stripe webhook URL unchanged: `https://jweyqlcvvmdyyqgqcsjd.supabase.co/functions/v1/stripe-webhook`

## 6. Launch smoke test

- [ ] `https://anymarkt.com` loads; favicon shows new mark
- [ ] `/robots.txt` and `/sitemap.xml` reference `anymarkt.com`
- [ ] Auth sign-up / reset stays on `anymarkt.com`
- [ ] Beta approval email from `@anymarkt.com`; link opens `/beta/welcome?token=...`
- [ ] `/share/market/:id` OG preview shows Anymarkt branding
- [ ] Stripe checkout returns to `anymarkt.com/wallet`
- [ ] `anymarket.expo.app` 301s to `anymarkt.com`
- [ ] Google Search Console: add property, submit sitemap

---

See also: [deploy-web-production.md](./deploy-web-production.md), [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md)
