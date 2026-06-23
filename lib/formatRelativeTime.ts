type RelativeTimeTranslator = (key: string, options?: Record<string, unknown>) => string;

export function formatRelativeTime(
  iso: string,
  t: RelativeTimeTranslator,
  _locale?: string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("timeJustNow");
  if (mins < 60) return t("timeMinutes", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("timeHours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("timeDays", { count: days });
}
