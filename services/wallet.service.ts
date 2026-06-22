import { supabase } from "../lib/supabase";
import type { Wallet } from "../types/user";

export interface WalletRecipient {
  id: string;
  username: string;
  email: string | null;
}

export interface TransferFundsInput {
  recipientId: string;
  amount: number;
  note?: string;
  clientReference?: string;
}

/**
 * Wallet service
 * Handles wallet operations (balance, transactions)
 * Note: Direct balance updates are restricted by RLS - use RPC functions or admin mode
 */
export const walletService = {
  /**
   * Get wallet for the current user
   */
  async getWallet(userId?: string): Promise<Wallet | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return null;
      }

      const { data: wallet, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching wallet:", error);
        return null;
      }

      // console.log("[WalletService] Fetched wallet data:", wallet);

      return wallet as Wallet;
    } catch (error) {
      console.error("Error fetching wallet:", error);
      return null;
    }
  },

  /**
   * Create a wallet for a user if it doesn't exist
   */
  async createWallet(userId: string): Promise<Wallet | null> {
    try {
      console.log(`[WalletService] Creating wallet for user ${userId}...`);

      const { data: newWallet, error } = await supabase
        .from("wallets")
        .insert({
          user_id: userId,
          balance: 0,
          is_virtual: true,
          currency: "USD",
        })
        .select()
        .single();

      if (error) {
        // If wallet already exists (race condition with trigger), just fetch it
        if (error.code === "23505") { // unique_violation
          console.log("[WalletService] Wallet already exists, fetching...");
          return this.getWallet(userId);
        }

        console.error("[WalletService] Error creating wallet:", error);
        return null;
      }

      return newWallet as Wallet;
    } catch (error) {
      console.error("[WalletService] Exception creating wallet:", error);
      return null;
    }
  },

  /**
   * Subscribe to wallet transactions
   */
  subscribeToTransactions(
    userId: string,
    callback: (payload: any) => void,
  ) {
    return supabase
      .channel(`transactions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload);
        },
      )
      .subscribe();
  },

  /**
   * Get wallet balance
   */
  async getBalance(userId?: string): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const wallet = await this.getWallet(userId);
    return wallet ? Number(wallet.balance) : 0;
  },

  /**
   * Add funds to wallet (admin/virtual mode only)
   * In production, this would be replaced with Stripe integration
   */
  async addFunds(
    amount: number,
    userId?: string,
  ): Promise<{ wallet: Wallet | null; error: Error | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return { wallet: null, error: new Error("Not authenticated") };
      }

      // Check if wallet exists
      let wallet = await this.getWallet(targetUserId);
      if (!wallet) {
        // Create wallet if it doesn't exist
        const { data: newWallet, error: createError } = await supabase
          .from("wallets")
          .insert({
            user_id: targetUserId,
            balance: amount,
            is_virtual: true,
          })
          .select()
          .single();

        if (createError || !newWallet) {
          return {
            wallet: null,
            error: createError || new Error("Failed to create wallet"),
          };
        }

        return { wallet: newWallet as Wallet, error: null };
      }

      // Update balance (this will fail in production due to RLS - use admin mode or RPC)
      const { data: updatedWallet, error } = await supabase
        .from("wallets")
        .update({ balance: Number(wallet.balance) + amount })
        .eq("user_id", targetUserId)
        .select()
        .single();

      if (error) {
        return { wallet: null, error };
      }

      return { wallet: updatedWallet as Wallet, error: null };
    } catch (error) {
      return { wallet: null, error: error as Error };
    }
  },

  /**
   * Deduct funds from wallet
   * Note: This is handled automatically by the place_bet RPC function
   * This method is for admin/testing purposes only
   */
  async deductFunds(
    amount: number,
    userId?: string,
  ): Promise<{ wallet: Wallet | null; error: Error | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return { wallet: null, error: new Error("Not authenticated") };
      }

      const wallet = await this.getWallet(targetUserId);
      if (!wallet) {
        return { wallet: null, error: new Error("Wallet not found") };
      }

      const newBalance = Number(wallet.balance) - amount;
      if (newBalance < 0) {
        return { wallet: null, error: new Error("Insufficient balance") };
      }

      // Update balance (this will fail in production due to RLS - use admin mode or RPC)
      const { data: updatedWallet, error } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", targetUserId)
        .select()
        .single();

      if (error) {
        return { wallet: null, error };
      }

      return { wallet: updatedWallet as Wallet, error: null };
    } catch (error) {
      return { wallet: null, error: error as Error };
    }
  },

  /**
   * Subscribe to wallet balance changes
   */
  subscribeToWallet(
    userId: string,
    callback: (wallet: Wallet) => void,
  ) {
    return supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Wallet);
        },
      )
      .subscribe();
  },

  /**
   * Create a PaymentIntent for wallet top-up
   */
  async createPaymentIntent(
    amount: number, // Amount in cents
    email?: string,
    userId?: string,
  ): Promise<
    {
      paymentIntent: string;
      ephemeralKey: string;
      customer: string;
      publishableKey: string;
    } | null
  > {
    try {
      console.log("[WalletService] Creating payment intent:", {
        amount,
        email,
        userId,
      });

      const cryptoApi =
        (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
      const requestId = cryptoApi?.randomUUID
        ? cryptoApi.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const { data, error } = await supabase.functions.invoke("payment-sheet", {
        body: { amount, email, requestId },
        headers: { "idempotency-key": requestId },
      });

      if (error) {
        console.error("[WalletService] Error creating payment intent:", error);
        // Try to get more details from the error
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            console.error(
              "[WalletService] Error details:",
              JSON.stringify(errorBody),
            );
          } catch {
            const errorText = await error.context.text?.();
            console.error("[WalletService] Error text:", errorText);
          }
        }
        return null;
      }

      console.log("[WalletService] Payment intent created successfully");
      return data;
    } catch (error: any) {
      console.error(
        "[WalletService] Exception creating payment intent:",
        error,
      );
      console.error("[WalletService] Error name:", error?.name);
      console.error("[WalletService] Error message:", error?.message);
      return null;
    }
  },

  /**
   * Create a Checkout Session for wallet top-up (web only)
   * Returns a URL to redirect to Stripe's hosted checkout page
   */
  async createCheckoutSession(
    amount: number, // Amount in cents
    userId: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ url: string; sessionId: string } | null> {
    try {
      console.log("[WalletService] Creating checkout session:", {
        amount,
        userId,
      });

      const { data, error } = await supabase.functions.invoke(
        "stripe-checkout",
        {
          body: { amount, successUrl, cancelUrl },
        },
      );

      if (error) {
        console.error(
          "[WalletService] Error creating checkout session:",
          error,
        );
        return null;
      }

      console.log("[WalletService] Checkout session created successfully");
      return data;
    } catch (error: any) {
      console.error(
        "[WalletService] Exception creating checkout session:",
        error,
      );
      return null;
    }
  },

  /**
   * Create a CustomerSession for card management
   */
  async createCustomerSession(userId: string): Promise<
    {
      customerSessionClientSecret: string;
      customerId: string;
      publishableKey: string;
    } | null
  > {
    try {
      const { data, error } = await supabase.functions.invoke(
        "customer-session",
        {
          body: {},
        },
      );

      if (error) {
        console.error("Error creating customer session:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error creating customer session:", error);
      return null;
    }
  },

  /**
   * Create a Connect account for the user
   */
  async createConnectAccount(
    userId: string,
    email: string,
    country: string = "US",
  ): Promise<{ accountId: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-connect-account",
        {
          body: { email, country },
        },
      );

      if (error) {
        console.error("Error creating connect account:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error creating connect account:", error);
      return null;
    }
  },

  /**
   * Create an account link for onboarding
   */
  async createAccountLink(
    userId: string,
    options?: { returnUrl?: string; refreshUrl?: string },
  ): Promise<{ url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-account-link",
        {
          body: {
            returnUrl: options?.returnUrl,
            refreshUrl: options?.refreshUrl,
          },
        },
      );

      if (error) {
        console.error("Error creating account link:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error creating account link:", error);
      return null;
    }
  },

  /**
   * Check if the Connect account is fully onboarded
   */
  async checkAccountStatus(
    userId: string,
  ): Promise<{ details_submitted: boolean; payouts_enabled: boolean } | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "check-account-status",
        {
          body: {},
        },
      );

      if (error) {
        console.error("Error checking account status:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error checking account status:", error);
      return null;
    }
  },

  async getOnboardingStatus(
    userId: string,
  ): Promise<
    | {
      state: "ready" | "needs_identity" | "pending_review";
      detailsSubmitted: boolean;
      payoutsEnabled: boolean;
    }
    | null
  > {
    const status = await this.checkAccountStatus(userId);
    if (!status) return null;

    if (status.payouts_enabled) {
      return {
        state: "ready",
        detailsSubmitted: true,
        payoutsEnabled: true,
      };
    }

    if (status.details_submitted) {
      return {
        state: "pending_review",
        detailsSubmitted: true,
        payoutsEnabled: false,
      };
    }

    return {
      state: "needs_identity",
      detailsSubmitted: false,
      payoutsEnabled: false,
    };
  },

  async startOnboarding(
    userId: string,
    email: string,
    linkOptions?: { returnUrl?: string; refreshUrl?: string },
  ): Promise<{ url: string } | null> {
    const wallet = await this.getWallet(userId);
    const country = wallet?.country ?? "US";
    const account = await this.createConnectAccount(userId, email, country);
    if (!account) return null;
    return this.createAccountLink(userId, linkOptions);
  },

  async lookupRecipient(query: string): Promise<WalletRecipient | null> {
    const normalized = query.trim();
    if (!normalized) return null;

    const { data, error } = await (supabase as any).rpc(
      "lookup_wallet_recipient",
      { p_query: normalized },
    );

    if (error) {
      console.error("[WalletService] lookupRecipient error:", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.user_id || !row?.username) {
      return null;
    }

    return {
      id: row.user_id,
      username: row.username,
      email: row.email ?? null,
    };
  },

  async sendFunds(input: TransferFundsInput): Promise<
    { success: true; senderBalance?: number } | { success: false; error: string }
  > {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid amount." };
    }

    const { data, error } = await (supabase as any).rpc(
      "transfer_wallet_funds",
      {
        p_recipient_id: input.recipientId,
        p_amount: amount,
        p_note: input.note || null,
        p_client_reference: input.clientReference || null,
      },
    );

    if (error) {
      console.error("[WalletService] sendFunds error:", error);
      return {
        success: false,
        error: error.message || "Failed to send funds.",
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: true,
      senderBalance: row?.sender_balance ? Number(row.sender_balance) : undefined,
    };
  },

  /**
   * Initiate a payout request
   */
  async payout(
    amount: number,
    userId: string,
  ): Promise<{ success: boolean; payoutRequest?: any } | null> {
    console.warn(
      "[WalletService] Legacy payout() is disabled; use withdrawToStripe().",
      { amount, userId },
    );
    return null;
  },

  /**
   * Withdraw funds to Stripe (Ecuador Payouts)
   */
  async withdrawToStripe(
    amount: number,
    userId: string,
  ): Promise<
    {
      success: boolean;
      needsOnboarding?: string;
      transferId?: string;
      error?: string;
    }
  > {
    try {
      console.log("[WalletService] Withdrawing to Stripe:", { amount, userId });

      // Debug: Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth
        .getSession();
      console.log("[WalletService] Withdrawal session check:", {
        hasSession: !!sessionData?.session,
        hasAccessToken: !!sessionData?.session?.access_token,
        sessionError: sessionError?.message,
      });

      const cryptoApi =
        (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
      const requestId = cryptoApi?.randomUUID
        ? cryptoApi.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const returnPath = typeof window !== "undefined" && window.location?.pathname
        ? window.location.pathname
        : "/wallet";

      const { data, error } = await supabase.functions.invoke(
        "stripe-withdrawal",
        {
          body: { amount, requestId, returnPath },
          headers: { "idempotency-key": requestId },
        },
      );

      if (error) {
        console.error("[WalletService] Error withdrawing to Stripe:", error);
        // Try to get more details from the error
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            console.error(
              "[WalletService] Withdrawal error details:",
              JSON.stringify(errorBody),
            );
          } catch {
            const errorText = await error.context.text?.();
            console.error("[WalletService] Withdrawal error text:", errorText);
          }
        }
        return { success: false, error: error.message || "Network error" };
      }

      console.log("[WalletService] Withdrawal response:", JSON.stringify(data));

      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        needsOnboarding: data.needsOnboarding,
        transferId: data.transferId,
      };
    } catch (error: any) {
      console.error("[WalletService] Exception withdrawing to Stripe:", error);
      console.error("[WalletService] Error name:", error?.name);
      console.error("[WalletService] Error message:", error?.message);
      return { success: false, error: error.message || "Unknown error" };
    }
  },

  /**
   * Withdraw USD ledger funds as a BTC payout through the configured provider.
   */
  async withdrawToBitcoin(
    amount: number,
    btcAddress: string,
  ): Promise<
    {
      success: boolean;
      transferId?: string;
      btcAmount?: number | null;
      error?: string;
    }
  > {
    try {
      const cryptoApi =
        (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
      const requestId = cryptoApi?.randomUUID
        ? cryptoApi.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const { data, error } = await supabase.functions.invoke(
        "btc-withdrawal",
        {
          body: { amount, btcAddress, requestId },
          headers: { "idempotency-key": requestId },
        },
      );

      if (error) {
        console.error("[WalletService] Error withdrawing to BTC:", error);
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            return { success: false, error: errorBody?.error || error.message };
          } catch {}
        }
        return { success: false, error: error.message || "Network error" };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        transferId: data?.transferId,
        btcAmount: data?.btcAmount ?? null,
      };
    } catch (error: any) {
      console.error("[WalletService] Exception withdrawing to BTC:", error);
      return { success: false, error: error.message || "Unknown error" };
    }
  },

  async submitVerificationDetails(
    userId: string,
    details: {
      firstName: string;
      lastName: string;
      dobDay: number;
      dobMonth: number;
      dobYear: number;
      addressLine1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      idNumber: string;
      externalAccountToken?: string;
    },
  ): Promise<{ success: true; error?: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "update-connect-account",
        {
          body: { ...details },
        },
      );

      if (error) {
        console.error("Functions error:", error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Error submitting verification:", err);
      return null;
    }
  },
  /**
   * Get wallet transactions for a user
   * @param userId - User ID to fetch transactions for
   * @param isPlayMode - Optional filter for play/live mode transactions
   */
  async getTransactions(userId?: string, isPlayMode?: boolean): Promise<any[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return [];
      }

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

      // Filter by play mode if specified
      if (isPlayMode !== undefined) {
        query = query.eq("is_play_mode", isPlayMode);
      }

      const { data: transactions, error } = await query;

      if (error) {
        console.error("Error fetching transactions:", error);
        return [];
      }

      return transactions || [];
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  },
  /**
   * Get withdrawal fee percentage
   */
  async getWithdrawalFee(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "withdrawal_fee_percent")
        .single();

      if (error || !data) return 0.05; // Default 5%
      const val = data.value;
      // Handle if it's a number or string
      if (typeof val === "number") return val;
      if (typeof val === "string") return parseFloat(val);
      return 0.05;
    } catch (e) {
      console.warn("Error fetching fee:", e);
      return 0.05;
    }
  },

  /**
   * Get play balance for a user
   */
  async getPlayBalance(userId?: string): Promise<number> {
    try {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      const stored = await AsyncStorage.getItem("@qbet_play_balance");
      if (stored !== null) return parseFloat(stored);
    } catch (e) {
      console.warn("Failed to read local play balance", e);
    }
    // Fallback to wallet or default
    return 1000;
  },

  /**
   * Update local play balance
   * Internal helper for bet service
   */
  async updatePlayBalance(newBalance: number): Promise<void> {
    try {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem("@qbet_play_balance", String(newBalance));
    } catch (e) {
      console.error("Error updating play balance:", e);
    }
  },
};
