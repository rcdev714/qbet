export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
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
          amount: number | null;
          id: string;
          market_id: string | null;
          option_id: string | null;
          placed_at: string | null;
          user_id: string | null;
        };
        Insert: {
          amount?: number | null;
          id?: string;
          market_id?: string | null;
          option_id?: string | null;
          placed_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount?: number | null;
          id?: string;
          market_id?: string | null;
          option_id?: string | null;
          placed_at?: string | null;
          user_id?: string | null;
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
      group_members: {
        Row: {
          group_id: string;
          joined_at: string | null;
          role: string | null;
          user_id: string;
        };
        Insert: {
          group_id: string;
          joined_at?: string | null;
          role?: string | null;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string | null;
          role?: string | null;
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
          admin_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string | null;
          share_code: string | null;
          avatar_url: string | null;
        };
        Insert: {
          admin_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string | null;
          share_code?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          admin_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string | null;
          share_code?: string | null;
          avatar_url?: string | null;
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
          code: string | null;
          created_at: string | null;
          created_by: string | null;
          expires_at: string | null;
          group_id: string | null;
          id: string;
          used: boolean | null;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          group_id?: string | null;
          id?: string;
          used?: boolean | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          group_id?: string | null;
          id?: string;
          used?: boolean | null;
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
      markets: {
        Row: {
          category: string | null;
          closes_at: string | null;
          created_at: string | null;
          creator_id: string | null;
          description: string | null;
          featured_at: string | null;
          group_id: string | null;
          id: string;
          image_url: string | null;
          is_public: boolean | null;
          question: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["market_status"] | null;
          updated_at: string | null;
          winning_option_id: string | null;
        };
        Insert: {
          category?: string | null;
          closes_at?: string | null;
          created_at?: string | null;
          creator_id?: string | null;
          description?: string | null;
          featured_at?: string | null;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_public?: boolean | null;
          question?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["market_status"] | null;
          updated_at?: string | null;
          winning_option_id?: string | null;
        };
        Update: {
          category?: string | null;
          closes_at?: string | null;
          created_at?: string | null;
          creator_id?: string | null;
          description?: string | null;
          featured_at?: string | null;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_public?: boolean | null;
          question?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["market_status"] | null;
          updated_at?: string | null;
          winning_option_id?: string | null;
        };
        Relationships: [
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
          group_id: string | null;
          id: string;
          market_id: string | null;
          message_type: string | null;
          user_id: string | null;
        };
        Insert: {
          content?: string | null;
          created_at?: string | null;
          group_id?: string | null;
          id?: string;
          market_id?: string | null;
          message_type?: string | null;
          user_id?: string | null;
        };
        Update: {
          content?: string | null;
          created_at?: string | null;
          group_id?: string | null;
          id?: string;
          market_id?: string | null;
          message_type?: string | null;
          user_id?: string | null;
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
      market_chat_messages: {
        Row: {
          id: string;
          market_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
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
      options: {
        Row: {
          created_at: string | null;
          id: string;
          label: string | null;
          market_id: string | null;
          total_pool: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          label?: string | null;
          market_id?: string | null;
          total_pool?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          label?: string | null;
          market_id?: string | null;
          total_pool?: number | null;
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
          amount: number | null;
          bank_details: Json | null;
          created_at: string | null;
          id: string;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          amount?: number | null;
          bank_details?: Json | null;
          created_at?: string | null;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount?: number | null;
          bank_details?: Json | null;
          created_at?: string | null;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
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
      transactions: {
        Row: {
          amount: number | null;
          created_at: string | null;
          fee_amount: number | null;
          id: string;
          metadata: Json | null;
          net_amount: number | null;
          reference_id: string | null;
          status: string | null;
          type: string | null;
          user_id: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          metadata?: Json | null;
          net_amount?: number | null;
          reference_id?: string | null;
          status?: string | null;
          type?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          metadata?: Json | null;
          net_amount?: number | null;
          reference_id?: string | null;
          status?: string | null;
          type?: string | null;
          user_id?: string | null;
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
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          id: string;
          is_admin: boolean | null;
          stripe_customer_id: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          id: string;
          is_admin?: boolean | null;
          stripe_customer_id?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
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
          amount: number | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          status: string | null;
          stripe_payment_intent_id: string | null;
          type: string | null;
          user_id: string | null;
          wallet_id: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string | null;
          stripe_payment_intent_id?: string | null;
          type?: string | null;
          user_id?: string | null;
          wallet_id?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string | null;
          stripe_payment_intent_id?: string | null;
          type?: string | null;
          user_id?: string | null;
          wallet_id?: string | null;
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
          balance: number | null;
          country: string | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          is_virtual: boolean | null;
          paypal_email: string | null;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          total_deposited: number | null;
          total_withdrawn: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          balance?: number | null;
          country?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          is_virtual?: boolean | null;
          paypal_email?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          total_deposited?: number | null;
          total_withdrawn?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          balance?: number | null;
          country?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          is_virtual?: boolean | null;
          paypal_email?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          total_deposited?: number | null;
          total_withdrawn?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
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
          joined_at: string | null;
          role: string | null;
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
      delete_group: { Args: { p_group_id: string }; Returns: boolean };
      generate_group_code: { Args: never; Returns: string };
      get_group_share_code: { Args: { p_group_id: string }; Returns: string };
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
          joined_at: string | null;
          role: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "group_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      place_bet: {
        Args: { p_amount: number; p_market_id: string; p_option_id: string };
        Returns: {
          amount: number | null;
          id: string;
          market_id: string | null;
          option_id: string | null;
          placed_at: string | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "bets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      resolve_market: {
        Args: { p_market_id: string; p_winning_option_id: string };
        Returns: {
          category: string | null;
          closes_at: string | null;
          created_at: string | null;
          creator_id: string | null;
          description: string | null;
          featured_at: string | null;
          group_id: string | null;
          id: string;
          image_url: string | null;
          is_public: boolean | null;
          question: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["market_status"] | null;
          updated_at: string | null;
          winning_option_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "markets";
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
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
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
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
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
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
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
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      market_status: ["open", "closed", "resolved", "cancelled"],
    },
  },
} as const;
