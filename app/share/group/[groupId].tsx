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

export default function ShareGroupRedirect() {
  const { groupId, invite, ref } = useLocalSearchParams<{
    groupId: string;
    invite?: string;
    ref?: string;
  }>();
  const id = first(groupId);
  if (!id) return <Redirect href="/" />;

  const query = buildQuery({ invite, ref });
  return <Redirect href={`/group/${encodeURIComponent(id)}${query}`} />;
}
