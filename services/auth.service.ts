import { supabase } from "../lib/supabase";
import type { User } from "../types/user";

export interface SignUpData {
  email: string;
  password: string;
  username?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Authentication service
 * Handles user sign up, sign in, sign out, and session management
 */
export const authService = {
  /**
   * Sign up a new user
   */
  async signUp(data: SignUpData): Promise<{ user: User | null; error: Error | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
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
  async signIn(data: SignInData): Promise<{ user: User | null; error: Error | null }> {
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

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return null;
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!user) {
        // User exists in Auth but not in public table. Create them.
        console.log("User missing in public table, creating...");
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({ id: authUser.id })
          .select()
          .single();

        if (createError) {
          console.error("Error creating user profile:", createError);
          return null;
        }
        return newUser as User;
      }

      if (error) {
        console.error("Error fetching user:", error);
        return null;
      }

      return user as User;
    } catch (error) {
      console.error("Error getting current user:", error);
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

