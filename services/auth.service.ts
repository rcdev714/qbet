import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import type { User } from "../types/user";
import { walletService } from "./wallet.service";

export interface SignUpData {
  email: string;
  password: string;
  username?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

const getAuthRedirectUrl = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  return Linking.createURL("/");
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

/**
 * Authentication service
 * Handles user sign up, sign in, sign out, and session management
 */
export const authService = {
  /**
   * Sign up a new user
   */
  async signUp(
    data: SignUpData,
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            username: data.username,
          },
        },
      });

      if (authError) {
        return { user: null, error: authError };
      }

      // Fetch the created user profile
      const user = await this.getCurrentUser();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  /**
   * Sign in an existing user
   */
  async signIn(
    data: SignInData,
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        return { user: null, error };
      }

      const user = await this.getCurrentUser();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  /**
   * Sign in with OAuth (Google) - Web Only
   */
  async signInWithOAuth(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: false, // Auto-redirect on web
          redirectTo: getAuthRedirectUrl(),
        },
      });

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async checkCanDeleteAccount(): Promise<{
    allowed: boolean;
    message?: string;
    reason?: string;
    error: Error | null;
  }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return {
          allowed: false,
          message: "You must be signed in to delete your account.",
          reason: "not_authenticated",
          error: null,
        };
      }

      const { data, error } = await (supabase as any).rpc("check_user_can_delete_account", {
        p_user_id: user.id,
      });

      if (error) {
        return { allowed: false, error };
      }

      const result = data as {
        allowed?: boolean;
        message?: string;
        reason?: string;
      };

      return {
        allowed: result?.allowed === true,
        message: result?.message,
        reason: result?.reason,
        error: null,
      };
    } catch (error) {
      return { allowed: false, error: error as Error };
    }
  },

  async deleteAccount(): Promise<{ error: Error | null; message?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: {},
      });

      if (error) {
        return { error };
      }

      if (data?.error) {
        return {
          error: new Error(String(data.error)),
          message: typeof data.error === "string" ? data.error : undefined,
        };
      }

      await this.signOut();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // Use getSession() first — it reads from localStorage (fast, no network).
      // Only call getUser() (which hits the network) if we have a session.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return null;
      }

      // Wrap the network calls in a timeout to prevent infinite hangs
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn("[AuthService] getCurrentUser timed out after 5s");
          resolve(null);
        }, 5000);
      });

      const fetchUser = async (): Promise<User | null> => {
        const ensureWallet = async () => {
          try {
            const wallet = await walletService.getWallet(session.user.id);
            if (!wallet) {
              await walletService.createWallet(session.user.id);
            }
          } catch (walletError) {
            if (isAbortError(walletError)) {
              console.warn("[AuthService] Wallet ensure aborted");
              return;
            }
            console.warn("[AuthService] Wallet ensure failed:", walletError);
          }
        };

        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          if (isAbortError(error)) {
            console.warn("[AuthService] User profile fetch aborted");
          } else {
            console.error("Error fetching user:", error);
          }
          return null;
        }

        if (!user) {
          // User exists in Auth but not in public table. Create them.
          console.log("User missing in public table, creating...");
          const metadata = session.user.user_metadata ?? {};
          const { data: newUser, error: createError } = await supabase
            .from("users")
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: typeof metadata.username === "string"
                ? metadata.username
                : null,
              avatar_url: typeof metadata.avatar_url === "string"
                ? metadata.avatar_url
                : null,
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating user profile:", createError);
            return null;
          }

          // Ensure wallet existence in the background; auth should not block on it.
          void ensureWallet();

          return newUser as User;
        }

        // Ensure wallet existence in the background; auth should not block on it.
        void ensureWallet();

        return user as User;
      };

      const currentUser = await Promise.race([fetchUser(), timeoutPromise]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return currentUser;
    } catch (error) {
      if (isAbortError(error)) {
        console.warn("[AuthService] getCurrentUser aborted");
      } else {
        console.error("Error getting current user:", error);
      }
      return null;
    }
  },

  /**
   * Get the current session
   */
  async getSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  },
};
