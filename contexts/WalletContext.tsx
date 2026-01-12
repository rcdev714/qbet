import React, { createContext, useContext, ReactNode } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAuthContext } from "./AuthContext";
import type { Wallet } from "../types/user";

interface WalletContextType {
  wallet: Wallet | null;
  balance: number;
  isVirtual: boolean;
  loading: boolean;
  error: Error | null;
  addFunds: (amount: number) => Promise<{ wallet: Wallet | null; error: Error | null }>;
  withdrawToStripe: (amount: number) => Promise<{ success: boolean; needsOnboarding?: string; transferId?: string; error?: string }>;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const wallet = useWallet(user?.id);

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

