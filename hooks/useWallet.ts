import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { walletService } from "../services/wallet.service";
import type { Wallet } from "../types/user";

export function useWallet(userId?: string) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const loadWallet = async () => {
      try {
        setLoading(true);
        const walletData = await walletService.getWallet(userId);
        setWallet(walletData);
        setError(null);

        // Subscribe to real-time updates
        if (walletData && walletData.user_id) {
          channel = walletService.subscribeToWallet(
            walletData.user_id,
            (updatedWallet) => {
              setWallet(updatedWallet);
            },
          );
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [userId]);

  const balance = wallet ? Number(wallet.balance) : 0;
  const isVirtual = wallet?.is_virtual ?? true;

  const addFunds = async (amount: number) => {
    const { wallet: updatedWallet, error: addError } = await walletService
      .addFunds(amount, userId);
    if (updatedWallet) {
      setWallet(updatedWallet);
    }
    return { wallet: updatedWallet, error: addError };
  };

  const withdrawToStripe = async (amount: number) => {
    if (!userId) return { success: false, error: "User not authenticated" };

    setLoading(true);
    const result = await walletService.withdrawToStripe(amount, userId);
    setLoading(false);

    if (result.success && !result.needsOnboarding) {
      // Refresh wallet to show deducted balance if transfer was immediate
      const walletData = await walletService.getWallet(userId);
      setWallet(walletData);
    }
    return result;
  };

  const refresh = async () => {
    setLoading(true);
    const walletData = await walletService.getWallet(userId);
    setWallet(walletData);
    setLoading(false);
  };

  return {
    wallet,
    balance,
    isVirtual,
    loading,
    error,
    addFunds,
    withdrawToStripe,
    refresh,
  };
}
