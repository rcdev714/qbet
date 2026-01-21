export interface MarketChatMessage {
    id: string;
    market_id: string;
    user_id: string;
    content: string;
    created_at: string;
    user?: {
        id: string;
        username: string | null;
        email: string | null;
        avatar_url: string | null;
    };
}
