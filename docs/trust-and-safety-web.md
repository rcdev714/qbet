# Web Trust And Safe Browsing Checklist

Keeps the public web app aligned with Safe Browsing expectations and documents a fast response path if a browser warning appears.

**Production canonical URL:** https://anymarket.expo.app  
**Hosting:** EAS Hosting (primary). Security headers also defined in [`vercel.json`](../vercel.json) for optional Vercel mirror deploys.

**Related:** [deploy-web-production.md](./deploy-web-production.md) · [docs/README.md](./README.md)

---

## Canonical domain and URLs

| Rule | Detail |
|------|--------|
| Single canonical host | `https://anymarket.expo.app` — set in EAS production + Supabase `EXPO_PUBLIC_APP_URL` secret |
| Client env | `EXPO_PUBLIC_APP_URL` in app `.env` / EAS must match canonical host |
| Email links | Beta approval emails use same base URL for `/beta/welcome?token=...` |
| Share / OG routes | `https://anymarket.expo.app/share/market/<id>` — server-rendered metadata for crawlers |
| No redirect chains | Public links resolve directly to market, group, wallet, auth, or onboarding |

---

## Preventative checks

- [ ] `EXPO_PUBLIC_APP_URL` aligned across EAS, Supabase secrets, and documentation
- [ ] Open Graph metadata accurate: titles, descriptions, images, canonical URLs match page content
- [ ] `og:locale` reflects user locale (`es_ES` / `en_US`) on market and onboarding pages
- [ ] No placeholder login, payment, or wallet pages mimicking another brand
- [ ] Auth, wallet, and payment screens clearly label **AnyMarket** as product name
- [ ] Real-money actions labeled as live funds, deposits, withdrawals, or bets
- [ ] User-generated links and images reviewed before promotion to public surfaces
- [ ] HTTPS-only assets; no mixed content
- [ ] Security headers active (see `vercel.json` — `X-Frame-Options`, `X-Content-Type-Options`, etc.)
- [ ] Beta approval emails sent from verified domain (`camella.app`) with consistent branding

---

## Content and UX rules

- Be explicit about AnyMarket on auth, wallet, and payment screens
- Label real-money actions clearly (live funds, deposits, withdrawals, bets)
- Every error state includes an exit: what happened and what the user can do next
- Destructive actions use specific confirmation labels (not generic “OK”)
- `/request-access` and `/beta/welcome` copy must not impersonate government or financial institutions
- WhatsApp contact link uses official business number from `lib/contact.ts`

---

## Email and transactional trust

| Item | Requirement |
|------|-------------|
| Sender domain | Verified in Resend (`camella.app`) |
| From address | `AnyMarket <onboarding@camella.app>` |
| Link destination | Same canonical host as app (`anymarket.expo.app`) |
| Subject / body | Clear beta approval purpose; no credential harvesting language |

---

## If a Safe Browsing warning appears

1. Verify the warning in Chrome, Safari, and Firefox
2. Check Google Search Console and [Safe Browsing Site Status](https://transparencyreport.google.com/safe-browsing/search) for `anymarket.expo.app`
3. Remove or disable suspicious redirects, public UGC, or impersonation-like copy
4. Check recent deploys (EAS Hosting → Deployments) for accidental route or asset changes
5. Submit correction via [Report Incorrect Phishing Warning](https://safebrowsing.google.com/safebrowsing/report_error/)
6. Redeploy after fixes; document affected URL, timeframe, and remediation

---

## Post-incident documentation

Record:

- Warning type and affected URL(s)
- First observed time (UTC)
- Deploy commit / EAS deployment ID
- Root cause (redirect, UGC, compromised asset, false positive)
- Remediation steps and Safe Browsing resubmission reference
