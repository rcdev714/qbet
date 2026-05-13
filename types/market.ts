import type { Database } from "./database";

export type MarketStatus = Database["public"]["Enums"]["market_status"];

export type MarketType = "binary" | "multi_option";

export type Market = Database["public"]["Tables"]["markets"]["Row"] & {
    creator?: { username: string | null; avatar_url: string | null } | null;
    market_type?: MarketType | null;
};
export type MarketInsert = Database["public"]["Tables"]["markets"]["Insert"];
export type MarketUpdate = Database["public"]["Tables"]["markets"]["Update"];

export type MarketOption = Database["public"]["Tables"]["options"]["Row"];
export type MarketOptionInsert =
    Database["public"]["Tables"]["options"]["Insert"];
export type MarketOptionUpdate =
    Database["public"]["Tables"]["options"]["Update"];

export type Bet = Database["public"]["Tables"]["bets"]["Row"] & {
    side?: "yes" | "no" | null;
    is_play_mode?: boolean;
};
export type BetWithDetails = Bet & {
    markets: Database["public"]["Tables"]["markets"]["Row"] | null;
    options: Database["public"]["Tables"]["options"]["Row"] | null;
};
export type BetInsert = Database["public"]["Tables"]["bets"]["Insert"];
export type BetUpdate = Database["public"]["Tables"]["bets"]["Update"];

/** Market with aggregated statistics */
export interface MarketWithStats extends Market {
    totalPool: number;
    betCount: number;
    optionStats: {
        optionId: string;
        label: string;
        yesPool: number;
        noPool: number;
        yesPrice: number;
        noPrice: number;
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
