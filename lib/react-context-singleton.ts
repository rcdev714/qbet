import { createContext, type Context } from "react";

type ContextRegistry = Record<string, Context<any>>;

const REGISTRY_KEY = "__ANYMARKET_REACT_CONTEXTS__";

function getContextRegistry(): ContextRegistry {
  const root =
    typeof window !== "undefined"
      ? window
      : typeof globalThis !== "undefined"
        ? globalThis
        : (global as typeof globalThis);

  const host = root as typeof globalThis & {
    [REGISTRY_KEY]?: ContextRegistry;
  };

  if (!host[REGISTRY_KEY]) {
    host[REGISTRY_KEY] = {};
  }

  return host[REGISTRY_KEY]!;
}

/**
 * Metro can evaluate the same context module twice when routes are loaded
 * asynchronously on web. A global singleton keeps Provider and hooks aligned.
 */
export function createContextSingleton<T>(key: string): Context<T | undefined> {
  const registry = getContextRegistry();
  if (!registry[key]) {
    registry[key] = createContext<T | undefined>(undefined) as Context<unknown>;
  }

  return registry[key] as Context<T | undefined>;
}
