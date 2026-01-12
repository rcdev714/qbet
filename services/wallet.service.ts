import { supabase } from "../lib/supabase";
import type { Wallet } from "../types/user";

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

      console.log("[WalletService] Fetched wallet data:", wallet);

      const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;
      console.log("[WalletService] adminEmail from env:", adminEmail);
      console.log("[WalletService] user email:", user?.email);

      // Override for admin email
      if (user?.email === adminEmail && (targetUserId === user?.id || !userId)) {
        console.log("[WalletService] Applying admin credit override");
        return {
          user_id: targetUserId,
          is_virtual: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(wallet || {}),
          balance: 1000, // Ensure balance is 1000
        } as Wallet;
      }

      return wallet as Wallet;
    } catch (error) {
      console.error("Error fetching wallet:", error);
      return null;
    }
  },

  /**
   * Get wallet balance
   */
  async getBalance(userId?: string): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;

    if (user?.email === adminEmail && (!userId || userId === user?.id)) {
      return 1000;
    }

    const wallet = await this.getWallet(userId);
    return wallet ? Number(wallet.balance) : 0;
  },

  /**
   * Add funds to wallet (admin/virtual mode only)
   * In production, this would be replaced with Stripe integration
   */
  async addFunds(
    amount: number,
    userId?: string
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
    userId?: string
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
    callback: (wallet: Wallet) => void
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
        }
      )
      .subscribe();
  },

  /**
   * Create a PaymentIntent for wallet top-up
   */
  async createPaymentIntent(
    amount: number, // Amount in cents
    email?: string,
    userId?: string
  ): Promise<{
    paymentIntent: string;
    ephemeralKey: string;
    customer: string;
    publishableKey: string;
  } | null> {
    try {
      const {
        data,
        error,
      } = await supabase.functions.invoke("payment-sheet", {
        body: { amount, email, userId },
      });

      if (error) {
        console.error("Error creating payment intent:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error creating payment intent:", error);
      return null;
    }
  },

  /**
   * Create a CustomerSession for card management
   */
  async createCustomerSession(userId: string): Promise<{
    customerSessionClientSecret: string;
    customerId: string;
    publishableKey: string;
  } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("customer-session", {
        body: { userId },
      });

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
  async createConnectAccount(userId: string, email: string, country: string = "US"): Promise<{ accountId: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: { userId, email, country },
      });

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
  async createAccountLink(userId: string): Promise<{ url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("create-account-link", {
        body: { userId },
      });

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
  async checkAccountStatus(userId: string): Promise<{ details_submitted: boolean; payouts_enabled: boolean } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("check-account-status", {
        body: { userId },
      });

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

  /**
   * Initiate a payout request
   */
  async payout(amount: number, userId: string): Promise<{ success: boolean; payoutRequest?: any } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("payout", {
        body: { amount, userId },
      });

      if (error) {
        console.error("Error initiating payout:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error initiating payout:", error);
      return null;
    }
  },

  /**
   * Withdraw funds to PayPal
   */
  /**
   * Withdraw funds to Stripe (Ecuador Payouts)
   */
  async withdrawToStripe(amount: number, userId: string): Promise<{ success: boolean; needsOnboarding?: string; transferId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-withdrawal", {
        body: { amount, userId },
      });

      if (error) {
        console.error("Error withdrawing to Stripe:", error);
        return { success: false, error: error.message || "Network error" };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        needsOnboarding: data.needsOnboarding,
        transferId: data.transferId
      };
    } catch (error: any) {
      console.error("Error withdrawing to Stripe:", error);
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
    }
  ): Promise<{ success: true; error?: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke("update-connect-account", {
        body: { userId, ...details },
      });

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
   */
  async getTransactions(userId?: string): Promise<any[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetUserId = userId || user?.id;
      if (!targetUserId) {
        return [];
      }

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

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
        .from('app_settings')
        .select('value')
        .eq('key', 'withdrawal_fee_percent')
        .single();

      if (error || !data) return 0.05; // Default 5%
      const val = data.value;
      // Handle if it's a number or string
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val);
      return 0.05;
    } catch (e) {
      console.warn('Error fetching fee:', e);
      return 0.05;
    }
  },
};

