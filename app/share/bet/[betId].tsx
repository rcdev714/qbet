import { Redirect, useLocalSearchParams } from "expo-router";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = first(value);
    if (normalized) search.set(key, normalized);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export default function ShareBetRedirect() {
  const { betId, ref } = useLocalSearchParams<{
    betId: string;
    ref?: string;
  }>();
  const id = first(betId);
  if (!id) return <Redirect href="/" />;

  const query = buildQuery({ ref });
  return <Redirect href={`/bet/${encodeURIComponent(id)}${query}`} />;
}
