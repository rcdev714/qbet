export interface DiscoverableUser {
    user_id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
    total_bets: number;
    is_following: boolean;
    win_rate?: number | null;
}

export function parseToggleFollowResponse(data: unknown): boolean {
    return Boolean((data as { following?: boolean })?.following);
}

export function mapDiscoverableUser(row: Record<string, unknown>): DiscoverableUser {
    return {
        user_id: String(row.user_id),
        username: String(row.username),
        avatar_url: (row.avatar_url as string | null) ?? null,
        created_at: String(row.created_at),
        total_bets: Number(row.total_bets ?? 0),
        is_following: Boolean(row.is_following),
    };
}

export function mapSuggestedUsers(rows: Record<string, unknown>[]): DiscoverableUser[] {
    return rows.map((row) => ({
        user_id: String(row.user_id),
        username: String(row.username),
        avatar_url: (row.avatar_url as string | null) ?? null,
        created_at: new Date().toISOString(),
        total_bets: Number(row.total_bets ?? 0),
        is_following: false,
        win_rate: row.win_rate != null ? Number(row.win_rate) : null,
    }));
}

export function mapDiscoverableUsers(rows: Record<string, unknown>[]): DiscoverableUser[] {
    return rows.map(mapDiscoverableUser);
}
