import {
  authService,
  type User,
} from "@anymarkt/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ user: User | null; error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const next = await authService.getCurrentUser();
    setUser(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const current = await authService.getCurrentUser();
        if (mounted) setUser(current);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data } = authService.onAuthStateChange((next) => {
      if (mounted) {
        setUser(next);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const { error } = await authService.signIn({ email, password });
        if (!error) await refreshUser();
        return { error };
      },
      signUp: async (email, password) => {
        const result = await authService.signUp({ email, password });
        if (!result.error) await refreshUser();
        return result;
      },
      signInWithGoogle: () => authService.signInWithOAuth(),
      signOut: async () => {
        const result = await authService.signOut();
        setUser(null);
        return result;
      },
      refreshUser,
    }),
    [user, loading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
