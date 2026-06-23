import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import {
    complianceService,
    type ComplianceProfile,
} from "../services/compliance.service";
import {
    walletService,
    type TransferFundsInput,
} from "../services/wallet.service";
import type { Wallet } from "../types/user";

const PLAY_MODE_KEY = "@qbet_play_mode";

export function useWallet(userId?: string) {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [playBalance, setPlayBalance] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPlayMode, setIsPlayMode] = useState(true);
  const [lastBetTime, setLastBetTime] = useState<number>(0);
  const [complianceProfile, setComplianceProfile] = useState<ComplianceProfile | null>(null);
  const [complianceLoaded, setComplianceLoaded] = useState(false);
  const complianceFetchSeq = useRef(0);

  const liveWalletReady =
    complianceProfile?.kyc_status === "verified" &&
    complianceProfile?.live_wallet_enabled === true;

  const refreshComplianceProfile = useCallback(async () => {
    const seq = ++complianceFetchSeq.current;

    if (!userId) {
      if (seq === complianceFetchSeq.current) {
        setComplianceProfile(null);
        setComplianceLoaded(true);
      }
      return null;
    }

    try {
      const profile = await complianceService.getProfile(userId);
      if (seq === complianceFetchSeq.current) {
        setComplianceProfile(profile);
        setComplianceLoaded(true);
      }
      return profile;
    } catch (e) {
      if (seq === complianceFetchSeq.current) {
        setComplianceLoaded(true);
      }
      console.warn("Failed to load compliance profile:", e);
      return null;
    }
  }, [userId]);

  const promptLiveWalletVerification = useCallback(() => {
    if (Platform.OS === "web") {
      router.push("/wallet/verify" as any);
      return;
    }

    Alert.alert(
      "Identity verification required",
      "Verify your identity to use the live wallet with real money.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Verify identity",
          onPress: () => router.push("/wallet/verify" as any),
        },
      ],
    );
  }, [router]);

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
    void loadPlayMode();
  }, []);

  useEffect(() => {
    setComplianceLoaded(false);
    void refreshComplianceProfile();
  }, [userId, refreshComplianceProfile]);

  useEffect(() => {
    if (!complianceLoaded || !userId) return;
    if (!liveWalletReady && !isPlayMode) {
      setIsPlayMode(true);
      void AsyncStorage.setItem(PLAY_MODE_KEY, "true");
    }
  }, [complianceLoaded, liveWalletReady, isPlayMode, userId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const loadWallet = async () => {
      try {
        setLoading(true);
        const walletData = await walletService.getWallet(userId);
        setWallet(walletData);

        const localPlayBalance = await walletService.getPlayBalance(userId);
        setPlayBalance(localPlayBalance);

        setError(null);

        if (walletData?.user_id) {
          channel = walletService.subscribeToWallet(walletData.user_id, (updatedWallet) => {
            setWallet(updatedWallet);
          });
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();

    return () => {
      channel?.unsubscribe();
    };
  }, [userId]);

  const liveBalance = wallet ? Number(wallet.balance) : 0;
  const balance = isPlayMode ? playBalance : liveBalance;
  const isVirtual = wallet?.is_virtual ?? true;

  const requestLiveMode = async (): Promise<boolean> => {
    const profile = await refreshComplianceProfile();
    const ready =
      profile?.kyc_status === "verified" && profile?.live_wallet_enabled === true;

    if (ready) {
      setIsPlayMode(false);
      await AsyncStorage.setItem(PLAY_MODE_KEY, "false");
      return true;
    }

    promptLiveWalletVerification();
    return false;
  };

  const toggleMode = async () => {
    if (isPlayMode) {
      await requestLiveMode();
      return;
    }

    const newMode = true;
    setIsPlayMode(newMode);
    try {
      await AsyncStorage.setItem(PLAY_MODE_KEY, String(newMode));
      const localPlayBalance = await walletService.getPlayBalance(userId);
      setPlayBalance(localPlayBalance);
    } catch (e) {
      console.warn("Failed to save play mode preference:", e);
    }
  };

  const addFunds = async (amount: number) => {
    const { wallet: updatedWallet, error: addError } = await walletService.addFunds(amount, userId);
    if (updatedWallet) setWallet(updatedWallet);
    return { wallet: updatedWallet, error: addError };
  };

  const withdrawToStripe = async (amount: number) => {
    if (!userId) return { success: false, error: "User not authenticated" };

    setLoading(true);
    const result = await walletService.withdrawToStripe(amount, userId);
    setLoading(false);

    if (result.success && !result.needsOnboarding) {
      const walletData = await walletService.getWallet(userId);
      setWallet(walletData);
    }
    return result;
  };

  const refresh = async () => {
    setLoading(true);
    const walletData = await walletService.getWallet(userId);
    setWallet(walletData);
    const localPlayBalance = await walletService.getPlayBalance(userId);
    setPlayBalance(localPlayBalance);
    await refreshComplianceProfile();
    setLoading(false);
  };

  const lookupRecipient = async (query: string) => walletService.lookupRecipient(query);

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
    balance,
    liveBalance,
    playBalance,
    isPlayMode,
    toggleMode,
    requestLiveMode,
    liveWalletReady,
    complianceProfile,
    refreshComplianceProfile,
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
