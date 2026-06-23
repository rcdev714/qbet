import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { setSentryUser } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { authService } from "../services/auth.service";
import type { User } from "../types/user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    const getAuthParams = (url: string) => {
      const params = new URLSearchParams();
      const [, queryAndHash = ""] = url.split("?");
      const [query = "", hash = ""] = queryAndHash.split("#");
      const hashFromUrl = url.includes("#") ? url.substring(url.indexOf("#") + 1) : hash;

      for (const source of [query, hashFromUrl]) {
        const cleanSource = source.startsWith("?") || source.startsWith("#")
          ? source.substring(1)
          : source;

        if (!cleanSource) continue;

        new URLSearchParams(cleanSource).forEach((value, key) => {
          params.set(key, value);
        });
      }

      return params;
    };

    // Handle deep link for auth callbacks from email confirmation or OAuth.
    const handleDeepLink = async (url: string) => {
      const params = getAuthParams(url);
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");

      if (errorCode || errorDescription) {
        console.error("[useAuth] Auth deep link error:", errorCode, errorDescription);
        return;
      }

      const code = params.get("code");
      if (code) {
        if (Platform.OS === "web") {
          // detectSessionInUrl handles web PKCE redirects automatically.
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Error exchanging auth code from deep link:", error);
        }
        return;
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Error setting session from deep link:", error);
        } else if (mounted) {
          setHasSession(true);
        }
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for deep links while app is open
    const linkSubscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    // Initialize auth state using the INITIAL_SESSION event from onAuthStateChange.
    // This is the Supabase-recommended approach: it handles session restoration from
    // storage automatically and fires INITIAL_SESSION once the session is available.
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[useAuth] Auth event:", event, "session:", !!session);

      if (
        event === "INITIAL_SESSION" || event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        if (session?.user) {
          if (mounted) {
            setHasSession(true);
            setLoading(false);
            initDone.current = true;
          }
          // Use setTimeout to avoid Supabase deadlock warning:
          // "Using the user object as returned from supabase.auth.getSession()
          //  or from some supabase.auth.onAuthStateChange() events could be insecure."
          // We fetch the full user profile from our users table in a non-blocking way.
          setTimeout(async () => {
            try {
              const currentUser = await authService.getCurrentUser();
              if (mounted) {
                // Keep the authenticated session even if profile hydration fails.
                if (currentUser) {
                  setUser(currentUser);
                }
              }
            } catch (err) {
              console.error("[useAuth] Error fetching user profile:", err);
            }
          }, 0);
        } else {
          // INITIAL_SESSION with no session = not logged in
          if (mounted) {
            setHasSession(false);
            setUser(null);
            setLoading(false);
            initDone.current = true;
          }
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setHasSession(false);
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Safety timeout: if auth state doesn't resolve within 8 seconds
    // (e.g. due to network issues), stop showing the spinner.
    const timeout = setTimeout(() => {
      if (mounted && !initDone.current) {
        console.warn(
          "[useAuth] Auth initialization timed out after 8s, proceeding as unauthenticated",
        );
        setHasSession(false);
        setLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      linkSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSentryUser(user?.id ?? null);
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { user: signedInUser, error } = await authService.signIn({
      email,
      password,
    });
    if (!error) {
      setHasSession(true);
      if (signedInUser) {
        setUser(signedInUser);
      }
    }
    setLoading(false);
    return { user: signedInUser, error };
  };

  const signUp = async (
    email: string,
    password: string,
    username?: string,
  ) => {
    setLoading(true);
    const { user: signedUpUser, error } = await authService.signUp({
      email,
      password,
      username,
    });
    if (!error) {
      setHasSession(true);
      if (signedUpUser) {
        setUser(signedUpUser);
        try {
          await supabase.functions.invoke("send-welcome-email", {
            body: { userId: signedUpUser.id },
          });
        } catch (welcomeError) {
          console.warn("[useAuth] welcome email failed", welcomeError);
        }
      }
    }
    setLoading(false);
    return { user: signedUpUser, error };
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await authService.signOut();
    if (!error) {
      setHasSession(false);
      setUser(null);
    }
    setLoading(false);
    return { error };
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await authService.signInWithOAuth();
    // No setLoading(false) here because the app will redirect away
    if (error) {
      setLoading(false);
    }
    return { error };
  };

  return {
    user,
    hasSession,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshUser: async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    },
    isAuthenticated: hasSession,
  };
}
