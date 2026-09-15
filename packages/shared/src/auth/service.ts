import type { Session, User as AuthUser } from "@supabase/supabase-js";

import { normalizeAuthEmail } from "../auth-errors";
import { getSupabase } from "../supabase";

export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type User = UserProfile;

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
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

/**
 * Web SPA authentication service (no Expo Linking / SecureStore).
 * Wallet ensure is deferred to native/Expo or a later P2 shared wallet module.
 */
export const authService = {
  async signUp(
    data: SignUpData,
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      const supabase = getSupabase();
      const { error: authError } = await supabase.auth.signUp({
        email: normalizeAuthEmail(data.email),
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

      const user = await this.getCurrentUser();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  },

  async signIn(
    data: SignInData,
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(data.email),
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

  async signInWithOAuth(): Promise<{ error: Error | null }> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: false,
          redirectTo: getAuthRedirectUrl(),
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await getSupabase().auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return null;
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn("[AuthService] getCurrentUser timed out after 5s");
          resolve(null);
        }, 5000);
      });

      const fetchUser = async (): Promise<User | null> => {
        const { data: user, error } = await supabase
          .from("users")
          .select("id, email, username, avatar_url")
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
          const metadata = session.user.user_metadata ?? {};
          const { data: newUser, error: createError } = await supabase
            .from("users")
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: typeof metadata.username === "string" ? metadata.username : null,
              avatar_url:
                typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
            } as never)
            .select("id, email, username, avatar_url")
            .single();

          if (createError) {
            console.error("Error creating user profile:", createError);
            return null;
          }

          return newUser as User;
        }

        return user as User;
      };

      const currentUser = await Promise.race([fetchUser(), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
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

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(
        normalizeAuthEmail(email),
        { redirectTo: `${getAuthRedirectUrl()}/auth/reset-password` },
      );
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return getSupabase().auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  },

  /** Expose auth user for session bootstrapping without profile round-trip. */
  async getAuthUser(): Promise<AuthUser | null> {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();
    return user;
  },
};
