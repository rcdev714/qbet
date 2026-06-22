export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      bets: {
        Row: {
          amount: number;
          id: string;
          is_play_mode: boolean | null;
          market_id: string;
          option_id: string;
          placed_at: string;
          side: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          id?: string;
          is_play_mode?: boolean | null;
          market_id: string;
          option_id: string;
          placed_at?: string;
          side?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          id?: string;
          is_play_mode?: boolean | null;
          market_id?: string;
          option_id?: string;
          placed_at?: string;
          side?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bets_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bets_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_follows: {
        Row: {
          category_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_follows_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "category_follows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          admin_response: string | null;
          challenger_id: string;
          created_at: string;
          evidence_url: string | null;
          id: string;
          market_id: string;
          reason: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string | null;
        };
        Insert: {
          admin_response?: string | null;
          challenger_id: string;
          created_at?: string;
          evidence_url?: string | null;
          id?: string;
          market_id: string;
          reason: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string | null;
        };
        Update: {
          admin_response?: string | null;
          challenger_id?: string;
          created_at?: string;
          evidence_url?: string | null;
          id?: string;
          market_id?: string;
          reason?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_challenger_id_fkey";
            columns: ["challenger_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          admin_id: string;
          avatar_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          share_code: string | null;
        };
        Insert: {
          admin_id: string;
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          share_code?: string | null;
        };
        Update: {
          admin_id?: string;
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          share_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "groups_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          group_id: string;
          id: string;
          used: boolean;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          group_id: string;
          id?: string;
          used?: boolean;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          group_id?: string;
          id?: string;
          used?: boolean;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      market_chat_messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          market_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          market_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          market_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_chat_messages_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      market_likes: {
        Row: {
          created_at: string;
          id: string;
          market_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          market_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          market_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_likes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      market_resolution_proofs: {
        Row: {
          evidence_notes: string | null;
          evidence_url: string | null;
          id: string;
          market_id: string;
          resolved_at: string;
          resolver_id: string;
          winning_option_id: string;
        };
        Insert: {
          evidence_notes?: string | null;
          evidence_url?: string | null;
          id?: string;
          market_id: string;
          resolved_at?: string;
          resolver_id: string;
          winning_option_id: string;
        };
        Update: {
          evidence_notes?: string | null;
          evidence_url?: string | null;
          id?: string;
          market_id?: string;
          resolved_at?: string;
          resolver_id?: string;
          winning_option_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_resolution_proofs_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: true;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_resolution_proofs_resolver_id_fkey";
            columns: ["resolver_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_resolution_proofs_winning_option_id_fkey";
            columns: ["winning_option_id"];
            isOneToOne: false;
            referencedRelation: "options";
            referencedColumns: ["id"];
          },
        ];
      };
      market_shares: {
        Row: {
          created_at: string;
          id: string;
          market_id: string;
          platform: string | null;
          share_code: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          market_id: string;
          platform?: string | null;
          share_code: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          market_id?: string;
          platform?: string | null;
          share_code?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_shares_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      markets: {
        Row: {
          category: string | null;
          category_id: string | null;
          closes_at: string | null;
          created_at: string;
          creator_id: string;
          description: string | null;
          featured_at: string | null;
          group_id: string | null;
          id: string;
          image_url: string | null;
          is_public: boolean | null;
          market_type: string | null;
          question: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["market_status"];
          updated_at: string;
          winning_option_id: string | null;
        };
        Insert: {
          category?: string | null;
          category_id?: string | null;
          closes_at?: string | null;
          created_at?: string;
          creator_id: string;
          description?: string | null;
          featured_at?: string | null;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_public?: boolean | null;
          market_type?: string | null;
          question: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          updated_at?: string;
          winning_option_id?: string | null;
        };
        Update: {
          category?: string | null;
          category_id?: string | null;
          closes_at?: string | null;
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          featured_at?: string | null;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_public?: boolean | null;
          market_type?: string | null;
          question?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          updated_at?: string;
          winning_option_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "markets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "options_market_id_fkey";
            columns: ["winning_option_id"];
            isOneToOne: false;
            referencedRelation: "options";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string | null;
          created_at: string | null;
          group_id: string;
          id: string;
          market_id: string | null;
          message_type: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string | null;
          group_id: string;
          id?: string;
          market_id?: string | null;
          message_type?: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string | null;
          group_id?: string;
          id?: string;
          market_id?: string | null;
          message_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      options: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          market_id: string;
          no_pool: number | null;
          total_pool: number;
          yes_pool: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          market_id: string;
          no_pool?: number | null;
          total_pool?: number;
          yes_pool?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          market_id?: string;
          no_pool?: number | null;
          total_pool?: number;
          yes_pool?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "options_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_requests: {
        Row: {
          amount: number;
          bank_details: Json | null;
          created_at: string | null;
          id: string;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          bank_details?: Json | null;
          created_at?: string | null;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          bank_details?: Json | null;
          created_at?: string | null;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          created_at: string | null;
          id: string;
          livemode: boolean | null;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          id: string;
          livemode?: boolean | null;
          type: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          livemode?: boolean | null;
          type?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          created_at: string | null;
          fee_amount: number | null;
          id: string;
          is_play_mode: boolean | null;
          metadata: Json | null;
          net_amount: number | null;
          reference_id: string | null;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          is_play_mode?: boolean | null;
          metadata?: Json | null;
          net_amount?: number | null;
          reference_id?: string | null;
          status?: string;
          type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          is_play_mode?: boolean | null;
          metadata?: Json | null;
          net_amount?: number | null;
          reference_id?: string | null;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_engagement: {
        Row: {
          category: string | null;
          id: string;
          market_id: string;
          updated_at: string | null;
          user_id: string;
          view_duration_ms: number | null;
          viewed_at: string | null;
          views: number | null;
        };
        Insert: {
          category?: string | null;
          id?: string;
          market_id: string;
          updated_at?: string | null;
          user_id: string;
          view_duration_ms?: number | null;
          viewed_at?: string | null;
          views?: number | null;
        };
        Update: {
          category?: string | null;
          id?: string;
          market_id?: string;
          updated_at?: string | null;
          user_id?: string;
          view_duration_ms?: number | null;
          viewed_at?: string | null;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_engagement_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_engagement_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_follows: {
        Row: {
          created_at: string;
          follower_id: string;
          following_id: string;
        };
        Insert: {
          created_at?: string;
          follower_id: string;
          following_id: string;
        };
        Update: {
          created_at?: string;
          follower_id?: string;
          following_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_stats: {
        Row: {
          best_streak: number | null;
          current_streak: number | null;
          total_bets: number | null;
          total_losses: number | null;
          total_profit: number | null;
          total_wagered: number | null;
          total_wins: number | null;
          updated_at: string | null;
          user_id: string;
          win_rate: number | null;
        };
        Insert: {
          best_streak?: number | null;
          current_streak?: number | null;
          total_bets?: number | null;
          total_losses?: number | null;
          total_profit?: number | null;
          total_wagered?: number | null;
          total_wins?: number | null;
          updated_at?: string | null;
          user_id: string;
          win_rate?: number | null;
        };
        Update: {
          best_streak?: number | null;
          current_streak?: number | null;
          total_bets?: number | null;
          total_losses?: number | null;
          total_profit?: number | null;
          total_wagered?: number | null;
          total_wins?: number | null;
          updated_at?: string | null;
          user_id?: string;
          win_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_admin: boolean | null;
          stripe_customer_id: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          is_admin?: boolean | null;
          stripe_customer_id?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_admin?: boolean | null;
          stripe_customer_id?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          stripe_payment_intent_id: string | null;
          type: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          type: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          type?: string;
          user_id?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number;
          country: string | null;
          created_at: string;
          currency: string;
          id: string;
          is_virtual: boolean;
          paypal_email: string | null;
          play_balance: number | null;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          total_deposited: number | null;
          total_withdrawn: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          country?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          is_virtual?: boolean;
          paypal_email?: string | null;
          play_balance?: number | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          total_deposited?: number | null;
          total_withdrawn?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          country?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          is_virtual?: boolean;
          paypal_email?: string | null;
          play_balance?: number | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          total_deposited?: number | null;
          total_withdrawn?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: {
        Args: { p_code: string };
        Returns: {
          group_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "group_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_funds: {
        Args: { p_amount: number; p_reference_id: string; p_user_id: string };
        Returns: undefined;
      };
      apply_wallet_refund: {
        Args: {
          p_amount: number;
          p_event_id: string;
          p_metadata?: Json;
          p_reference_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      apply_wallet_topup: {
        Args: {
          p_amount: number;
          p_event_id: string;
          p_metadata?: Json;
          p_reference_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      create_category: {
        Args: {
          p_color?: string;
          p_description?: string;
          p_icon?: string;
          p_name: string;
          p_parent_id?: string;
          p_slug: string;
        };
        Returns: {
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "categories";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_notification: {
        Args: {
          p_body?: string;
          p_data?: Json;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: {
          body: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_group: { Args: { p_group_id: string }; Returns: boolean };
      fail_wallet_withdrawal: {
        Args: {
          p_failure_code: string;
          p_failure_message: string;
          p_metadata?: Json;
          p_reference_id: string;
        };
        Returns: undefined;
      };
      finalize_wallet_withdrawal: {
        Args: {
          p_fee_amount: number;
          p_metadata?: Json;
          p_net_amount: number;
          p_reference_id: string;
          p_transfer_id: string;
        };
        Returns: undefined;
      };
      generate_group_code: { Args: never; Returns: string };
      generate_share_code: { Args: never; Returns: string };
      get_categories: {
        Args: never;
        Returns: {
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "categories";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_follow_counts: {
        Args: { p_user_id: string };
        Returns: {
          followers_count: number;
          following_count: number;
        }[];
      };
      get_group_share_code: { Args: { p_group_id: string }; Returns: string };
      get_leaderboard: {
        Args: { p_limit?: number; p_metric?: string };
        Returns: {
          avatar_url: string;
          total_bets: number;
          total_profit: number;
          user_id: string;
          username: string;
          win_rate: number;
        }[];
      };
      get_market_social_stats: {
        Args: { p_market_id: string };
        Returns: {
          comment_count: number;
          like_count: number;
          share_count: number;
        }[];
      };
      get_notifications: {
        Args: { p_limit?: number; p_unread_only?: boolean };
        Returns: {
          body: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_resolution_proof: {
        Args: { p_market_id: string };
        Returns: {
          evidence_notes: string | null;
          evidence_url: string | null;
          id: string;
          market_id: string;
          resolved_at: string;
          resolver_id: string;
          winning_option_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "market_resolution_proofs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_unread_notification_count: { Args: never; Returns: number };
      is_group_admin: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      join_group_by_code: {
        Args: { p_code: string };
        Returns: {
          group_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "group_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_all_notifications_read: { Args: never; Returns: number };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: {
          body: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      place_bet:
        | {
          Args: {
            p_amount: number;
            p_market_id: string;
            p_option_id: string;
            p_side?: string;
          };
          Returns: {
            amount: number;
            id: string;
            is_play_mode: boolean | null;
            market_id: string;
            option_id: string;
            placed_at: string;
            side: string | null;
            user_id: string;
          };
          SetofOptions: {
            from: "*";
            to: "bets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        }
        | {
          Args: {
            p_amount: number;
            p_is_play_mode?: boolean;
            p_market_id: string;
            p_option_id: string;
            p_side?: string;
          };
          Returns: {
            amount: number;
            id: string;
            is_play_mode: boolean | null;
            market_id: string;
            option_id: string;
            placed_at: string;
            side: string | null;
            user_id: string;
          };
          SetofOptions: {
            from: "*";
            to: "bets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        };
      refresh_play_credits: {
        Args: never;
        Returns: {
          balance: number;
          country: string | null;
          created_at: string;
          currency: string;
          id: string;
          is_virtual: boolean;
          paypal_email: string | null;
          play_balance: number | null;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          total_deposited: number | null;
          total_withdrawn: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "wallets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      reserve_wallet_withdrawal: {
        Args: {
          p_amount: number;
          p_metadata?: Json;
          p_reference_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      resolve_dispute: {
        Args: {
          p_admin_response?: string;
          p_dispute_id: string;
          p_status: string;
        };
        Returns: {
          admin_response: string | null;
          challenger_id: string;
          created_at: string;
          evidence_url: string | null;
          id: string;
          market_id: string;
          reason: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_market:
        | {
          Args: { p_market_id: string; p_winning_option_id: string };
          Returns: {
            category: string | null;
            category_id: string | null;
            closes_at: string | null;
            created_at: string;
            creator_id: string;
            description: string | null;
            featured_at: string | null;
            group_id: string | null;
            id: string;
            image_url: string | null;
            is_public: boolean | null;
            question: string;
            resolved_at: string | null;
            status: Database["public"]["Enums"]["market_status"];
            updated_at: string;
            winning_option_id: string | null;
          };
          SetofOptions: {
            from: "*";
            to: "markets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        }
        | {
          Args: {
            p_evidence_notes?: string;
            p_evidence_url?: string;
            p_market_id: string;
            p_winning_option_id: string;
          };
          Returns: {
            category: string | null;
            category_id: string | null;
            closes_at: string | null;
            created_at: string;
            creator_id: string;
            description: string | null;
            featured_at: string | null;
            group_id: string | null;
            id: string;
            image_url: string | null;
            is_public: boolean | null;
            question: string;
            resolved_at: string | null;
            status: Database["public"]["Enums"]["market_status"];
            updated_at: string;
            winning_option_id: string | null;
          };
          SetofOptions: {
            from: "*";
            to: "markets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        };
      resolve_market_with_vig: {
        Args: {
          p_market_id: string;
          p_vig_percent?: number;
          p_winning_option_id: string;
        };
        Returns: undefined;
      };
      resolve_public_market:
        | {
          Args: { p_market_id: string; p_winning_option_id: string };
          Returns: {
            category: string | null;
            category_id: string | null;
            closes_at: string | null;
            created_at: string;
            creator_id: string;
            description: string | null;
            featured_at: string | null;
            group_id: string | null;
            id: string;
            image_url: string | null;
            is_public: boolean | null;
            question: string;
            resolved_at: string | null;
            status: Database["public"]["Enums"]["market_status"];
            updated_at: string;
            winning_option_id: string | null;
          };
          SetofOptions: {
            from: "*";
            to: "markets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        }
        | {
          Args: {
            p_evidence_notes?: string;
            p_evidence_url?: string;
            p_market_id: string;
            p_winning_option_id: string;
          };
          Returns: {
            category: string | null;
            category_id: string | null;
            closes_at: string | null;
            created_at: string;
            creator_id: string;
            description: string | null;
            featured_at: string | null;
            group_id: string | null;
            id: string;
            image_url: string | null;
            is_public: boolean | null;
            question: string;
            resolved_at: string | null;
            status: Database["public"]["Enums"]["market_status"];
            updated_at: string;
            winning_option_id: string | null;
          };
          SetofOptions: {
            from: "*";
            to: "markets";
            isOneToOne: true;
            isSetofReturn: false;
          };
        };
      submit_dispute: {
        Args: {
          p_evidence_url?: string;
          p_market_id: string;
          p_reason: string;
        };
        Returns: {
          admin_response: string | null;
          challenger_id: string;
          created_at: string;
          evidence_url: string | null;
          id: string;
          market_id: string;
          reason: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      toggle_market_like: { Args: { p_market_id: string }; Returns: Json };
      toggle_user_follow: { Args: { p_target_user_id: string }; Returns: Json };
      track_market_share: {
        Args: { p_market_id: string; p_platform?: string };
        Returns: string;
      };
      track_entity_share: {
        Args: {
          p_entity_type: string;
          p_entity_id: string;
          p_platform?: string;
        };
        Returns: string;
      };
      update_category: {
        Args: {
          p_category_id: string;
          p_color?: string;
          p_description?: string;
          p_icon?: string;
          p_is_active?: boolean;
          p_name?: string;
          p_sort_order?: number;
        };
        Returns: {
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "categories";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_engagement: {
        Args: {
          p_category: string;
          p_duration_ms: number;
          p_market_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      market_status: "open" | "closed" | "resolved" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      market_status: ["open", "closed", "resolved", "cancelled"],
    },
  },
} as const;
