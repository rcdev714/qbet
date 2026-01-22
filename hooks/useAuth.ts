import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { authService } from "../services/auth.service";
import type { User } from "../types/user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle deep link for auth callback
    const handleDeepLink = async (url: string) => {
      if (url.includes("access_token") || url.includes("refresh_token")) {
        // Extract the fragment (everything after #)
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const fragment = url.substring(hashIndex + 1);
          const params = new URLSearchParams(fragment);
          
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          
          if (accessToken && refreshToken) {
            // Set the session from the tokens
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error("Error setting session from deep link:", error);
            }
          }
        }
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    // Get initial user
    authService.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription: authSubscription },
    } = authService.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      subscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { user: signedInUser, error } = await authService.signIn({
      email,
      password,
    });
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
    setLoading(false);
    return { user: signedUpUser, error };
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await authService.signOut();
    setLoading(false);
    return { error };
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser: async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    },
    isAuthenticated: !!user,
  };
}
