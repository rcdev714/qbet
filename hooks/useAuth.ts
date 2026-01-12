import { useEffect, useState } from "react";
import { authService } from "../services/auth.service";
import type { User } from "../types/user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    authService.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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
