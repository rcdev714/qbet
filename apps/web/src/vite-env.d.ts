/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_BETA_REQUIRED?: string;
  readonly VITE_LAUNCH_JURISDICTION?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly EXPO_PUBLIC_SUPABASE_URL?: string;
  readonly EXPO_PUBLIC_SUPABASE_KEY?: string;
  readonly EXPO_PUBLIC_APP_URL?: string;
  readonly EXPO_PUBLIC_ADMIN_EMAIL?: string;
  readonly EXPO_PUBLIC_BETA_REQUIRED?: string;
  readonly EXPO_PUBLIC_LAUNCH_JURISDICTION?: string;
  readonly EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  readonly EXPO_PUBLIC_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
