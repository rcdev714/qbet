import type { Database } from "./database";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];
export type UserProfileInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserProfileUpdate = Database["public"]["Tables"]["users"]["Update"];

// Alias for convenience (used throughout the codebase)
export type User = UserProfile;

export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type WalletInsert = Database["public"]["Tables"]["wallets"]["Insert"];
export type WalletUpdate = Database["public"]["Tables"]["wallets"]["Update"];


