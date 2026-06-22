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

export default function ShareMarketRedirect() {
  const { marketId, group, invite, ref, bet } = useLocalSearchParams<{
    marketId: string;
    group?: string;
    invite?: string;
    ref?: string;
    bet?: string;
  }>();
  const id = first(marketId);
  if (!id) return <Redirect href="/" />;

  const query = buildQuery({ group, invite, ref, bet });
  return <Redirect href={`/market/${encodeURIComponent(id)}${query}`} />;
}
