import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
    type TransferFundsInput,
    walletService,
} from "../services/wallet.service";
import type { Wallet } from "../types/user";

const PLAY_MODE_KEY = "@qbet_play_mode";

export function useWallet(userId?: string) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [playBalance, setPlayBalance] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPlayMode, setIsPlayMode] = useState(true); // Default to play mode
  const [lastBetTime, setLastBetTime] = useState<number>(0);

  // Load play mode preference from AsyncStorage
  useEffect(() => {
    const loadPlayMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(PLAY_MODE_KEY);
        if (stored !== null) {
          setIsPlayMode(stored === "true");
        }
      } catch (e) {
        console.warn("Failed to load play mode preference:", e);
      }
    };
    loadPlayMode();
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const loadWallet = async () => {
      try {
        setLoading(true);
        // Load live wallet
        const walletData = await walletService.getWallet(userId);
        setWallet(walletData);

        // Load play balance locally
        const localPlayBalance = await walletService.getPlayBalance(userId);
        setPlayBalance(localPlayBalance);

        setError(null);

        // Subscribe to real-time updates for LIVE wallet
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

  // Calculate balances
  const liveBalance = wallet ? Number(wallet.balance) : 0;

  // Active balance based on current mode
  const balance = isPlayMode ? playBalance : liveBalance;
  const isVirtual = wallet?.is_virtual ?? true;

  const toggleMode = async () => {
    const newMode = !isPlayMode;
    setIsPlayMode(newMode);
    try {
      await AsyncStorage.setItem(PLAY_MODE_KEY, String(newMode));
      // Refresh balance when switching modes ensures up-to-date view
      if (newMode) {
        const localPlayBalance = await walletService.getPlayBalance(userId);
        setPlayBalance(localPlayBalance);
      }
    } catch (e) {
      console.warn("Failed to save play mode preference:", e);
    }
  };

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
    // Refresh live
    const walletData = await walletService.getWallet(userId);
    setWallet(walletData);

    // Refresh play
    const localPlayBalance = await walletService.getPlayBalance(userId);
    setPlayBalance(localPlayBalance);

    setLoading(false);
  };

  const lookupRecipient = async (query: string) => {
    return walletService.lookupRecipient(query);
  };

  const sendFunds = async (input: TransferFundsInput) => {
    const result = await walletService.sendFunds(input);
    if (result.success && userId) {
      const walletData = await walletService.getWallet(userId);
      setWallet(walletData);
    }
    return result;
  };

  const notifyBetPlaced = () => {
    setLastBetTime(Date.now());
  };

  return {
    wallet,
    balance, // Active balance based on current mode
    liveBalance, // Real Stripe money
    playBalance, // Play credits
    isPlayMode, // Current mode
    toggleMode, // Switch between modes
    isVirtual,
    loading,
    error,
    addFunds,
    withdrawToStripe,
    refresh,
    lookupRecipient,
    sendFunds,
    lastBetTime,
    notifyBetPlaced,
  };
}
