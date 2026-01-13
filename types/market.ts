import type { Database } from "./database";

export type MarketStatus = Database["public"]["Enums"]["market_status"];

export type Market = Database["public"]["Tables"]["markets"]["Row"];
export type MarketInsert = Database["public"]["Tables"]["markets"]["Insert"];
export type MarketUpdate = Database["public"]["Tables"]["markets"]["Update"];

export type MarketOption = Database["public"]["Tables"]["options"]["Row"];
export type MarketOptionInsert =
    Database["public"]["Tables"]["options"]["Insert"];
export type MarketOptionUpdate =
    Database["public"]["Tables"]["options"]["Update"];

export type Bet = Database["public"]["Tables"]["bets"]["Row"];
export type BetInsert = Database["public"]["Tables"]["bets"]["Insert"];
export type BetUpdate = Database["public"]["Tables"]["bets"]["Update"];

/** Market with aggregated statistics */
export interface MarketWithStats extends Market {
    totalPool: number;
    betCount: number;
    optionStats: {
        optionId: string;
        label: string;
        pool: number;
        percentage: number;
    }[];
    recentBets: {
        optionId: string;
        amount: number;
        placedAt: string;
    }[];
}

/** Market context type for distinguishing market origins */
export type MarketContext = "public" | "private";
