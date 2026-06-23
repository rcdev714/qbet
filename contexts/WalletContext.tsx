import React, { createContext, ReactNode, useContext } from "react";
import { useWallet } from "../hooks/useWallet";
import type { ComplianceProfile } from "../services/compliance.service";
import type {
    TransferFundsInput,
    WalletRecipient,
} from "../services/wallet.service";
import type { Wallet } from "../types/user";
import { useAuthContext } from "./AuthContext";

interface WalletContextType {
  wallet: Wallet | null;
  balance: number;
  liveBalance: number;
  playBalance: number;
  isPlayMode: boolean;
  toggleMode: () => Promise<void>;
  requestLiveMode: () => Promise<boolean>;
  liveWalletReady: boolean;
  complianceProfile: ComplianceProfile | null;
  refreshComplianceProfile: () => Promise<ComplianceProfile | null>;
  isVirtual: boolean;
  loading: boolean;
  error: Error | null;
  addFunds: (amount: number) => Promise<{ wallet: Wallet | null; error: Error | null }>;
  withdrawToStripe: (amount: number) => Promise<{ success: boolean; needsOnboarding?: string; transferId?: string; error?: string }>;
  refresh: () => Promise<void>;
  lookupRecipient: (query: string) => Promise<WalletRecipient | null>;
  sendFunds: (input: TransferFundsInput) => Promise<{ success: true; senderBalance?: number } | { success: false; error: string }>;
  lastBetTime: number;
  notifyBetPlaced: () => void;
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
