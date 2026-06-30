export function buildEmailLayout(params: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  appUrl: string;
  footerNote?: string;
}): string {
  const ctaBlock =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:24px 0;">
  <a href="${params.ctaUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">${params.ctaLabel}</a>
</p>`
      : "";

  const settingsUrl = `${params.appUrl.replace(/\/$/, "")}/settings/notifications`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${params.title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#0f172a;margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;">Anymarkt</p>
              ${params.bodyHtml}
              ${ctaBlock}
              <p style="color:#64748b;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
                ${params.footerNote ?? "Anymarkt — social prediction infrastructure."}
                <br><a href="${settingsUrl}" style="color:#64748b;">Manage notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPlainTextLayout(params: {
  body: string;
  ctaUrl?: string;
  appUrl: string;
}): string {
  const settingsUrl = `${params.appUrl.replace(/\/$/, "")}/settings/notifications`;
  const cta = params.ctaUrl ? `\n\n${params.ctaUrl}` : "";
  return `${params.body}${cta}\n\n---\nAnymarkt\nManage preferences: ${settingsUrl}`;
}
