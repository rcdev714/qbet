# Web Trust And Safe Browsing Checklist

This checklist keeps the public web app aligned with Safe Browsing expectations and gives the team a fast response path if a browser warning ever appears.

## Preventative Checks

- Serve the production app from one stable canonical domain and keep `EXPO_PUBLIC_APP_URL` aligned with it.
- Avoid suspicious redirect chains. Public links should resolve directly to the intended market, group, wallet, or auth destination.
- Keep Open Graph metadata accurate: titles, descriptions, image URLs, and canonical URLs should describe the actual page.
- Do not publish placeholder login, payment, or wallet pages that mimic another brand.
- Review user-generated links and images before promoting them to public surfaces.
- Keep security headers active on Vercel through `vercel.json`.
- Use HTTPS-only assets and avoid mixed content.

## If A Warning Appears

1. Verify the warning in Chrome, Safari, and Firefox.
2. Check Google Search Console and the [Safe Browsing Site Status](https://transparencyreport.google.com/safe-browsing/search).
3. Remove or disable any suspicious redirects, public user-generated content, or impersonation-like copy.
4. Submit a correction through [Google Safe Browsing Report Incorrect Phishing Warning](https://safebrowsing.google.com/safebrowsing/report_error/).
5. Redeploy after fixes and document the affected URL, timeframe, and remediation.

## Copy And Content Rules

- Be explicit about AnyMarket as the product name on auth, wallet, and payment screens.
- Label real-money actions clearly as live funds, deposits, withdrawals, or bets.
- Give every error an exit: explain what happened and what the user can do next.
- Keep destructive actions confirmed with specific action labels.
