export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      bets: {
        Row: {
          id: string;
          user_id: string;
          market_id: string;
          option_id: string;
          amount: number;
          placed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          market_id: string;
          option_id: string;
          amount: number;
          placed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          market_id?: string;
          option_id?: string;
          amount?: number;
          placed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
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
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          joined_at: string;
          role: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          joined_at?: string;
          role?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          joined_at?: string;
          role?: string;
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
          id: string;
          name: string;
          description: string | null;
          admin_id: string;
          created_at: string;
          share_code: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          admin_id: string;
          created_at?: string;
          share_code?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          admin_id?: string;
          created_at?: string;
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
          id: string;
          group_id: string;
          created_by: string;
          code: string;
          expires_at: string | null;
          used: boolean;
          used_by: string | null;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          created_by: string;
          code: string;
          expires_at?: string | null;
          used?: boolean;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          created_by?: string;
          code?: string;
          expires_at?: string | null;
          used?: boolean;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
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
      markets: {
        Row: {
          id: string;
          group_id: string;
          creator_id: string;
          question: string;
          description: string | null;
          closes_at: string | null;
          resolved_at: string | null;
          winning_option_id: string | null;
          status: Database["public"]["Enums"]["market_status"];
          created_at: string;
          updated_at: string;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          creator_id: string;
          question: string;
          description?: string | null;
          closes_at?: string | null;
          resolved_at?: string | null;
          winning_option_id?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          created_at?: string;
          updated_at?: string;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          creator_id?: string;
          question?: string;
          description?: string | null;
          closes_at?: string | null;
          resolved_at?: string | null;
          winning_option_id?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markets_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          content: string | null;
          message_type: string;
          market_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          content?: string | null;
          message_type?: string;
          market_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          content?: string | null;
          message_type?: string;
          market_id?: string | null;
          created_at?: string;
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
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
        ];
      };
      options: {
        Row: {
          id: string;
          market_id: string;
          label: string;
          total_pool: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          label: string;
          total_pool?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          label?: string;
          total_pool?: number;
          created_at?: string;
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
      users: {
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          currency: string;
          is_virtual: boolean;
          stripe_customer_id: string | null;
          stripe_account_id: string | null;
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          currency?: string;
          is_virtual?: boolean;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          balance?: number;
          currency?: string;
          is_virtual?: boolean;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          country?: string;
          created_at?: string;
          updated_at?: string;
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
    Views: Record<string, never>;
    Functions: {
      place_bet: {
        Args: { p_market_id: string; p_option_id: string; p_amount: number };
        Returns: Database["public"]["Tables"]["bets"]["Row"];
      };
      resolve_market: {
        Args: { p_market_id: string; p_winning_option_id: string };
        Returns: Database["public"]["Tables"]["markets"]["Row"];
      };
      accept_invite: {
        Args: { p_code: string };
        Returns: Database["public"]["Tables"]["group_members"]["Row"];
      };
      join_group_by_code: {
        Args: { p_code: string };
        Returns: Database["public"]["Tables"]["group_members"]["Row"];
      };
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_group_admin: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      get_group_share_code: {
        Args: { p_group_id: string };
        Returns: string;
      };
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      delete_group: {
        Args: { p_group_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      market_status: "open" | "closed" | "resolved" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
