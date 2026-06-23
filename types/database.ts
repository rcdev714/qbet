export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_ledger_entries: {
        Row: {
          amount: number
          created_at: string
          crypto_transaction_id: string | null
          currency: string
          direction: string
          entry_type: string
          id: string
          market_id: string | null
          metadata: Json
          provider: string | null
          provider_reference_id: string | null
          tax_period: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          crypto_transaction_id?: string | null
          currency?: string
          direction: string
          entry_type: string
          id?: string
          market_id?: string | null
          metadata?: Json
          provider?: string | null
          provider_reference_id?: string | null
          tax_period?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          crypto_transaction_id?: string | null
          currency?: string
          direction?: string
          entry_type?: string
          id?: string
          market_id?: string | null
          metadata?: Json
          provider?: string | null
          provider_reference_id?: string | null
          tax_period?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_ledger_entries_crypto_transaction_id_fkey"
            columns: ["crypto_transaction_id"]
            isOneToOne: false
            referencedRelation: "crypto_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ledger_entries_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      bets: {
        Row: {
          amount: number
          id: string
          is_play_mode: boolean | null
          market_id: string
          option_id: string
          placed_at: string
          side: string | null
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          is_play_mode?: boolean | null
          market_id: string
          option_id: string
          placed_at?: string
          side?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          is_play_mode?: boolean | null
          market_id?: string
          option_id?: string
          placed_at?: string
          side?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_option_matches_market_fkey"
            columns: ["option_id", "market_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id", "market_id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_follows: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_follows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          action: string | null
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          decision: string | null
          event_type: string
          id: string
          market_id: string | null
          metadata: Json
          provider: string | null
          provider_event_id: string | null
          reason_code: string | null
          subject_id: string | null
          subject_type: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          decision?: string | null
          event_type: string
          id?: string
          market_id?: string | null
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          reason_code?: string | null
          subject_id?: string | null
          subject_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          decision?: string | null
          event_type?: string
          id?: string
          market_id?: string | null
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          reason_code?: string | null
          subject_id?: string | null
          subject_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_jurisdiction_rules: {
        Row: {
          allowed_crypto_assets: string[]
          allowed_payment_providers: string[]
          crypto_rails_requires_provider_kyc: boolean
          jurisdiction: string
          notes: string | null
          public_sports_markets_allowed: boolean
          real_money_requires_kyc: boolean
          tax_and_aml_export_required: boolean
          updated_at: string
        }
        Insert: {
          allowed_crypto_assets?: string[]
          allowed_payment_providers?: string[]
          crypto_rails_requires_provider_kyc?: boolean
          jurisdiction: string
          notes?: string | null
          public_sports_markets_allowed?: boolean
          real_money_requires_kyc?: boolean
          tax_and_aml_export_required?: boolean
          updated_at?: string
        }
        Update: {
          allowed_crypto_assets?: string[]
          allowed_payment_providers?: string[]
          crypto_rails_requires_provider_kyc?: boolean
          jurisdiction?: string
          notes?: string | null
          public_sports_markets_allowed?: boolean
          real_money_requires_kyc?: boolean
          tax_and_aml_export_required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      crypto_payments: {
        Row: {
          amount_usd: number
          created_at: string | null
          crypto_currency: string | null
          id: string
          nowpayments_id: string | null
          order_id: string
          payment_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string | null
          crypto_currency?: string | null
          id?: string
          nowpayments_id?: string | null
          order_id: string
          payment_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string | null
          crypto_currency?: string | null
          id?: string
          nowpayments_id?: string | null
          order_id?: string
          payment_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_transactions: {
        Row: {
          created_at: string
          credited_transaction_id: string | null
          crypto_amount: number | null
          crypto_asset: string | null
          direction: string
          fiat_amount: number | null
          fiat_currency: string
          id: string
          last_webhook_event_id: string | null
          metadata: Json
          network: string | null
          platform_fee: number | null
          provider: string
          provider_fee: number | null
          provider_transaction_id: string
          raw_status: string | null
          refund_wallet_address: string | null
          reserved_transaction_id: string | null
          settled_at: string | null
          status: string
          transaction_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          credited_transaction_id?: string | null
          crypto_amount?: number | null
          crypto_asset?: string | null
          direction: string
          fiat_amount?: number | null
          fiat_currency?: string
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          network?: string | null
          platform_fee?: number | null
          provider?: string
          provider_fee?: number | null
          provider_transaction_id: string
          raw_status?: string | null
          refund_wallet_address?: string | null
          reserved_transaction_id?: string | null
          settled_at?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          credited_transaction_id?: string | null
          crypto_amount?: number | null
          crypto_asset?: string | null
          direction?: string
          fiat_amount?: number | null
          fiat_currency?: string
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          network?: string | null
          platform_fee?: number | null
          provider?: string
          provider_fee?: number | null
          provider_transaction_id?: string
          raw_status?: string | null
          refund_wallet_address?: string | null
          reserved_transaction_id?: string | null
          settled_at?: string | null
          status?: string
          transaction_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_transactions_credited_transaction_id_fkey"
            columns: ["credited_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_transactions_reserved_transaction_id_fkey"
            columns: ["reserved_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_response: string | null
          challenger_id: string
          created_at: string
          evidence_url: string | null
          id: string
          market_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          admin_response?: string | null
          challenger_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          market_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          admin_response?: string | null
          challenger_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          market_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_shares: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          platform: string | null
          share_code: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          platform?: string | null
          share_code: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          platform?: string | null
          share_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          admin_id: string
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          share_code: string | null
        }
        Insert: {
          admin_id: string
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          share_code?: string | null
        }
        Update: {
          admin_id?: string
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          share_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verification_sessions: {
        Row: {
          completed_at: string | null
          country: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_webhook_event_id: string | null
          metadata: Json
          provider: string
          provider_customer_id: string | null
          provider_report_id: string | null
          provider_session_id: string
          retry_count: number
          status: string
          updated_at: string
          user_id: string
          verification_level: string
        }
        Insert: {
          completed_at?: string | null
          country?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          provider: string
          provider_customer_id?: string | null
          provider_report_id?: string | null
          provider_session_id: string
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
          verification_level?: string
        }
        Update: {
          completed_at?: string | null
          country?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          provider?: string
          provider_customer_id?: string | null
          provider_report_id?: string | null
          provider_session_id?: string
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          verification_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verification_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_chat_messages: {
        Row: {
          bet_id: string | null
          content: string
          created_at: string | null
          id: string
          market_id: string
          message_type: string
          referenced_group_id: string | null
          referenced_user_id: string | null
          user_id: string
        }
        Insert: {
          bet_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          market_id: string
          message_type?: string
          referenced_group_id?: string | null
          referenced_user_id?: string | null
          user_id: string
        }
        Update: {
          bet_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          market_id?: string
          message_type?: string
          referenced_group_id?: string | null
          referenced_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_chat_messages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_compliance_reviews: {
        Row: {
          category: string
          created_at: string
          creator_attestation: boolean
          creator_id: string | null
          evidence_requirements: string | null
          id: string
          market_id: string
          metadata: Json
          notes: string | null
          public_feed_allowed: boolean
          reason_code: string | null
          resolution_source: string | null
          resolver_type: string
          review_state: string
          reviewed_at: string | null
          reviewer_id: string | null
          sensitivity_tier: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          creator_attestation?: boolean
          creator_id?: string | null
          evidence_requirements?: string | null
          id?: string
          market_id: string
          metadata?: Json
          notes?: string | null
          public_feed_allowed?: boolean
          reason_code?: string | null
          resolution_source?: string | null
          resolver_type?: string
          review_state?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          sensitivity_tier?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_attestation?: boolean
          creator_id?: string | null
          evidence_requirements?: string | null
          id?: string
          market_id?: string
          metadata?: Json
          notes?: string | null
          public_feed_allowed?: boolean
          reason_code?: string | null
          resolution_source?: string | null
          resolver_type?: string
          review_state?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          sensitivity_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_compliance_reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_compliance_reviews_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_compliance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_likes: {
        Row: {
          created_at: string
          id: string
          market_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_likes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_resolution_proofs: {
        Row: {
          evidence_notes: string | null
          evidence_url: string | null
          id: string
          market_id: string
          resolved_at: string
          resolver_id: string
          winning_option_id: string
        }
        Insert: {
          evidence_notes?: string | null
          evidence_url?: string | null
          id?: string
          market_id: string
          resolved_at?: string
          resolver_id: string
          winning_option_id: string
        }
        Update: {
          evidence_notes?: string | null
          evidence_url?: string | null
          id?: string
          market_id?: string
          resolved_at?: string
          resolver_id?: string
          winning_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_resolution_proofs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_resolution_proofs_resolver_id_fkey"
            columns: ["resolver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_resolution_proofs_winning_option_id_fkey"
            columns: ["winning_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
        ]
      }
      market_shares: {
        Row: {
          created_at: string
          id: string
          market_id: string
          platform: string | null
          share_code: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          platform?: string | null
          share_code: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          platform?: string | null
          share_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_shares_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string | null
          category_id: string | null
          closes_at: string | null
          compliance_review_state: string | null
          created_at: string
          creator_id: string
          description: string | null
          featured_at: string | null
          group_id: string | null
          id: string
          image_url: string | null
          is_public: boolean | null
          market_category: string | null
          market_type: string | null
          public_feed_allowed: boolean | null
          question: string
          resolution_source: string | null
          resolved_at: string | null
          resolver_type: string | null
          sensitivity_tier: string | null
          status: Database["public"]["Enums"]["market_status"]
          updated_at: string
          winning_option_id: string | null
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          closes_at?: string | null
          compliance_review_state?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          featured_at?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          market_category?: string | null
          market_type?: string | null
          public_feed_allowed?: boolean | null
          question: string
          resolution_source?: string | null
          resolved_at?: string | null
          resolver_type?: string | null
          sensitivity_tier?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
          winning_option_id?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string | null
          closes_at?: string | null
          compliance_review_state?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          featured_at?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          market_category?: string | null
          market_type?: string | null
          public_feed_allowed?: boolean | null
          question?: string
          resolution_source?: string | null
          resolved_at?: string | null
          resolver_type?: string | null
          sensitivity_tier?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
          winning_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_winning_option_matches_market_fkey"
            columns: ["winning_option_id", "id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id", "market_id"]
          },
        ]
      }
      messages: {
        Row: {
          bet_id: string | null
          content: string | null
          created_at: string | null
          group_id: string
          id: string
          market_id: string | null
          message_type: string
          referenced_group_id: string | null
          referenced_user_id: string | null
          user_id: string
        }
        Insert: {
          bet_id?: string | null
          content?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          market_id?: string | null
          message_type?: string
          referenced_group_id?: string | null
          referenced_user_id?: string | null
          user_id: string
        }
        Update: {
          bet_id?: string | null
          content?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          market_id?: string | null
          message_type?: string
          referenced_group_id?: string | null
          referenced_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moonpay_payments: {
        Row: {
          amount_usd: number
          created_at: string | null
          crypto_currency: string | null
          external_transaction_id: string | null
          failure_reason: string | null
          id: string
          moonpay_transaction_id: string | null
          payment_type: string
          status: string | null
          updated_at: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string | null
          crypto_currency?: string | null
          external_transaction_id?: string | null
          failure_reason?: string | null
          id?: string
          moonpay_transaction_id?: string | null
          payment_type: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string | null
          crypto_currency?: string | null
          external_transaction_id?: string | null
          failure_reason?: string | null
          id?: string
          moonpay_transaction_id?: string | null
          payment_type?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          created_at: string
          id: string
          label: string
          market_id: string
          no_pool: number | null
          total_pool: number
          yes_pool: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          market_id: string
          no_pool?: number | null
          total_pool?: number
          yes_pool?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          market_id?: string
          no_pool?: number | null
          total_pool?: number
          yes_pool?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "options_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_accounts: {
        Row: {
          capabilities: Json
          country: string | null
          created_at: string
          currency: string | null
          id: string
          metadata: Json
          provider: string
          provider_account_id: string
          provider_account_type: string
          restrictions: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capabilities?: Json
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json
          provider: string
          provider_account_id: string
          provider_account_type: string
          restrictions?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capabilities?: Json
          country?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json
          provider?: string
          provider_account_id?: string
          provider_account_type?: string
          restrictions?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          bank_details: Json | null
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_details?: Json | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_details?: Json | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          content_hash: string
          created_at: string
          effective_at: string
          id: string
          is_required: boolean
          jurisdiction: string
          kind: string
          retired_at: string | null
          title: string
          url: string | null
          version: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          effective_at?: string
          id?: string
          is_required?: boolean
          jurisdiction?: string
          kind: string
          retired_at?: string | null
          title: string
          url?: string | null
          version: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          effective_at?: string
          id?: string
          is_required?: boolean
          jurisdiction?: string
          kind?: string
          retired_at?: string | null
          title?: string
          url?: string | null
          version?: string
        }
        Relationships: []
      }
      supported_residence_countries: {
        Row: {
          country_code: string
          default_jurisdiction: string
          dial_code: string
          is_launch_enabled: boolean
          name: string
          sort_order: number
        }
        Insert: {
          country_code: string
          default_jurisdiction: string
          dial_code: string
          is_launch_enabled?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          country_code?: string
          default_jurisdiction?: string
          dial_code?: string
          is_launch_enabled?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      prohibited_market_categories: {
        Row: {
          category: string
          public_feed_allowed: boolean
          reason: string
          requires_manual_review: boolean
          sensitivity_tier: string
          updated_at: string
        }
        Insert: {
          category: string
          public_feed_allowed?: boolean
          reason: string
          requires_manual_review?: boolean
          sensitivity_tier: string
          updated_at?: string
        }
        Update: {
          category?: string
          public_feed_allowed?: boolean
          reason?: string
          requires_manual_review?: boolean
          sensitivity_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_report_periods: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string
          metadata: Json
          period_end: string
          period_start: string
          prepared_at: string | null
          prepared_by: string | null
          status: string
          submitted_at: string | null
          totals: Json
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction?: string
          metadata?: Json
          period_end: string
          period_start: string
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          submitted_at?: string | null
          totals?: Json
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string
          metadata?: Json
          period_end?: string
          period_start?: string
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          submitted_at?: string | null
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_report_periods_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_charge_refunds: {
        Row: {
          charge_id: string
          created_at: string
          last_event_id: string | null
          metadata: Json
          refunded_amount: number
          updated_at: string
        }
        Insert: {
          charge_id: string
          created_at?: string
          last_event_id?: string | null
          metadata?: Json
          refunded_amount?: number
          updated_at?: string
        }
        Update: {
          charge_id?: string
          created_at?: string
          last_event_id?: string | null
          metadata?: Json
          refunded_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string | null
          id: string
          livemode: boolean | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id: string
          livemode?: boolean | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          livemode?: boolean | null
          type?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          fee_amount: number | null
          id: string
          is_play_mode: boolean | null
          metadata: Json | null
          net_amount: number | null
          reference_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          fee_amount?: number | null
          id?: string
          is_play_mode?: boolean | null
          metadata?: Json | null
          net_amount?: number | null
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          fee_amount?: number | null
          id?: string
          is_play_mode?: boolean | null
          metadata?: Json | null
          net_amount?: number | null
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_compliance_profiles: {
        Row: {
          age_verified: boolean
          created_at: string
          crypto_rails_enabled: boolean
          jurisdiction: string
          kyc_provider: string
          kyc_status: string
          last_reviewed_at: string | null
          live_wallet_enabled: boolean
          metadata: Json
          restricted_at: string | null
          restriction_reason: string | null
          review_status: string
          risk_tier: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          age_verified?: boolean
          created_at?: string
          crypto_rails_enabled?: boolean
          jurisdiction?: string
          kyc_provider?: string
          kyc_status?: string
          last_reviewed_at?: string | null
          live_wallet_enabled?: boolean
          metadata?: Json
          restricted_at?: string | null
          restriction_reason?: string | null
          review_status?: string
          risk_tier?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          age_verified?: boolean
          created_at?: string
          crypto_rails_enabled?: boolean
          jurisdiction?: string
          kyc_provider?: string
          kyc_status?: string
          last_reviewed_at?: string | null
          live_wallet_enabled?: boolean
          metadata?: Json
          restricted_at?: string | null
          restriction_reason?: string | null
          review_status?: string
          risk_tier?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_compliance_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_engagement: {
        Row: {
          category: string | null
          id: string
          market_id: string
          updated_at: string | null
          user_id: string
          view_duration_ms: number | null
          viewed_at: string | null
          views: number | null
        }
        Insert: {
          category?: string | null
          id?: string
          market_id: string
          updated_at?: string | null
          user_id: string
          view_duration_ms?: number | null
          viewed_at?: string | null
          views?: number | null
        }
        Update: {
          category?: string | null
          id?: string
          market_id?: string
          updated_at?: string | null
          user_id?: string
          view_duration_ms?: number | null
          viewed_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_engagement_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_engagement_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_policy_acceptances: {
        Row: {
          accepted_at: string
          app_version: string | null
          id: string
          ip_hash: string | null
          locale: string | null
          metadata: Json
          policy_version_id: string
          source: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          app_version?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string | null
          metadata?: Json
          policy_version_id: string
          source?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          app_version?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string | null
          metadata?: Json
          policy_version_id?: string
          source?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_policy_acceptances_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_policy_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          best_streak: number | null
          current_streak: number | null
          total_bets: number | null
          total_losses: number | null
          total_profit: number | null
          total_wagered: number | null
          total_wins: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          best_streak?: number | null
          current_streak?: number | null
          total_bets?: number | null
          total_losses?: number | null
          total_profit?: number | null
          total_wagered?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          best_streak?: number | null
          current_streak?: number | null
          total_bets?: number | null
          total_losses?: number | null
          total_profit?: number | null
          total_wagered?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          country_of_residence: string | null
          created_at: string
          email: string | null
          id: string
          is_admin: boolean | null
          phone_country_code: string | null
          phone_e164: string | null
          residence_set_at: string | null
          stripe_customer_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country_of_residence?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_admin?: boolean | null
          phone_country_code?: string | null
          phone_e164?: string | null
          residence_set_at?: string | null
          stripe_customer_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country_of_residence?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_admin?: boolean | null
          phone_country_code?: string | null
          phone_e164?: string | null
          residence_set_at?: string | null
          stripe_customer_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          country: string | null
          created_at: string
          currency: string
          global_recipient_id: string | null
          id: string
          is_virtual: boolean
          payout_method_id: string | null
          paypal_email: string | null
          play_balance: number | null
          stripe_account_id: string | null
          stripe_customer_id: string | null
          total_deposited: number | null
          total_withdrawn: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          country?: string | null
          created_at?: string
          currency?: string
          global_recipient_id?: string | null
          id?: string
          is_virtual?: boolean
          payout_method_id?: string | null
          paypal_email?: string | null
          play_balance?: number | null
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          total_deposited?: number | null
          total_withdrawn?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          country?: string | null
          created_at?: string
          currency?: string
          global_recipient_id?: string | null
          id?: string
          is_virtual?: boolean
          payout_method_id?: string | null
          paypal_email?: string | null
          play_balance?: number | null
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          total_deposited?: number | null
          total_withdrawn?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_code: string }
        Returns: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_funds: {
        Args: { p_amount: number; p_reference_id: string; p_user_id: string }
        Returns: undefined
      }
      apply_crypto_onramp_credit: {
        Args: {
          p_metadata?: Json
          p_provider: string
          p_provider_event_id?: string
          p_provider_transaction_id: string
        }
        Returns: string
      }
      apply_wallet_refund: {
        Args: {
          p_amount: number
          p_event_id: string
          p_metadata?: Json
          p_reference_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      apply_wallet_topup: {
        Args: {
          p_amount: number
          p_event_id: string
          p_metadata?: Json
          p_reference_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_approve_market_for_feed: {
        Args: { p_market_id: string }
        Returns: Database["public"]["Tables"]["markets"]["Row"]
      }
      admin_promote_market_to_feed: {
        Args: { p_market_id: string }
        Returns: Database["public"]["Tables"]["markets"]["Row"]
      }
      assert_compliance_gate: {
        Args: {
          p_action: string
          p_amount?: number
          p_crypto_asset?: string
          p_crypto_network?: string
          p_market_id?: string
          p_provider?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_category: {
        Args: {
          p_color?: string
          p_description?: string
          p_icon?: string
          p_name: string
          p_parent_id?: string
          p_slug: string
        }
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_market_with_options: {
        Args: {
          p_category?: string
          p_closes_at?: string
          p_compliance_category?: string
          p_creator_attestation?: boolean
          p_description?: string
          p_featured_at?: string
          p_group_id?: string
          p_image_url?: string
          p_is_public?: boolean
          p_labels: string[]
          p_market_type?: string
          p_metadata?: Json
          p_question: string
          p_resolution_source?: string
          p_resolver_type?: string
          p_status?: Database["public"]["Enums"]["market_status"]
        }
        Returns: Database["public"]["Tables"]["markets"]["Row"]
      }
      create_notification: {
        Args: {
          p_body?: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_group: { Args: { p_group_id: string }; Returns: boolean }
      fail_wallet_withdrawal: {
        Args: {
          p_failure_code: string
          p_failure_message: string
          p_metadata?: Json
          p_reference_id: string
        }
        Returns: undefined
      }
      finalize_wallet_withdrawal: {
        Args: {
          p_fee_amount: number
          p_metadata?: Json
          p_net_amount: number
          p_reference_id: string
          p_transfer_id: string
        }
        Returns: undefined
      }
      generate_entity_share_code: { Args: never; Returns: string }
      generate_group_code: { Args: never; Returns: string }
      generate_share_code: { Args: never; Returns: string }
      get_admin_daily_financial_series: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_admin_financial_kpis: { Args: never; Returns: Json }
      get_categories: {
        Args: never
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_follow_counts: {
        Args: { p_user_id: string }
        Returns: {
          followers_count: number
          following_count: number
        }[]
      }
      get_group_share_code: { Args: { p_group_id: string }; Returns: string }
      get_leaderboard: {
        Args: { p_limit?: number; p_metric?: string }
        Returns: {
          avatar_url: string
          total_bets: number
          total_profit: number
          user_id: string
          username: string
          win_rate: number
        }[]
      }
      get_market_social_stats: {
        Args: { p_market_id: string }
        Returns: {
          comment_count: number
          like_count: number
          share_count: number
        }[]
      }
      get_notifications: {
        Args: { p_limit?: number; p_unread_only?: boolean }
        Returns: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_resolution_proof: {
        Args: { p_market_id: string }
        Returns: {
          evidence_notes: string | null
          evidence_url: string | null
          id: string
          market_id: string
          resolved_at: string
          resolver_id: string
          winning_option_id: string
        }
        SetofOptions: {
          from: "*"
          to: "market_resolution_proofs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_compliance_jurisdiction: {
        Args: { p_user_id: string }
        Returns: string
      }
      has_current_policy_acceptances: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_app_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_group_admin: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      insert_market_options: {
        Args: { p_labels: string[]; p_market_id: string }
        Returns: Database["public"]["Tables"]["options"]["Row"][]
      }
      join_group_by_code: {
        Args: { p_code: string }
        Returns: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lookup_wallet_recipient: {
        Args: { p_query: string }
        Returns: {
          email: string
          user_id: string
          username: string
        }[]
      }
      list_admin_content_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json[]
      }
      list_admin_transactions: {
        Args: {
          p_is_play_mode?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_type?: string
        }
        Returns: Json[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_bet:
        | {
            Args: {
              p_amount: number
              p_market_id: string
              p_option_id: string
              p_side?: string
            }
            Returns: {
              amount: number
              id: string
              is_play_mode: boolean | null
              market_id: string
              option_id: string
              placed_at: string
              side: string | null
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "bets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_amount: number
              p_is_play_mode?: boolean
              p_market_id: string
              p_option_id: string
              p_side?: string
            }
            Returns: {
              amount: number
              id: string
              is_play_mode: boolean | null
              market_id: string
              option_id: string
              placed_at: string
              side: string | null
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "bets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      prepare_regulatory_report_period: {
        Args: {
          p_jurisdiction: string
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          created_at: string
          id: string
          jurisdiction: string
          metadata: Json
          period_end: string
          period_start: string
          prepared_at: string | null
          prepared_by: string | null
          status: string
          submitted_at: string | null
          totals: Json
        }
        SetofOptions: {
          from: "*"
          to: "regulatory_report_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_wallet_from_stripe_deposits: {
        Args: { p_user_id: string }
        Returns: number
      }
      record_compliance_event: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_decision?: string
          p_event_type: string
          p_market_id?: string
          p_metadata?: Json
          p_provider?: string
          p_provider_event_id?: string
          p_reason_code?: string
          p_user_id: string
        }
        Returns: string
      }
      refresh_play_credits: {
        Args: never
        Returns: {
          balance: number
          country: string | null
          created_at: string
          currency: string
          global_recipient_id: string | null
          id: string
          is_virtual: boolean
          payout_method_id: string | null
          paypal_email: string | null
          play_balance: number | null
          stripe_account_id: string | null
          stripe_customer_id: string | null
          total_deposited: number | null
          total_withdrawn: number | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      reserve_wallet_withdrawal: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_reference_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      set_user_residence: {
        Args: { p_country: string; p_phone_e164?: string | null }
        Returns: Json
      }
      resolve_dispute: {
        Args: {
          p_admin_response?: string
          p_dispute_id: string
          p_status: string
        }
        Returns: {
          admin_response: string | null
          challenger_id: string
          created_at: string
          evidence_url: string | null
          id: string
          market_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_market:
        | {
            Args: { p_market_id: string; p_winning_option_id: string }
            Returns: {
              category: string | null
              category_id: string | null
              closes_at: string | null
              compliance_review_state: string | null
              created_at: string
              creator_id: string
              description: string | null
              featured_at: string | null
              group_id: string | null
              id: string
              image_url: string | null
              is_public: boolean | null
              market_category: string | null
              market_type: string | null
              public_feed_allowed: boolean | null
              question: string
              resolution_source: string | null
              resolved_at: string | null
              resolver_type: string | null
              sensitivity_tier: string | null
              status: Database["public"]["Enums"]["market_status"]
              updated_at: string
              winning_option_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "markets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_evidence_notes?: string
              p_evidence_url?: string
              p_market_id: string
              p_winning_option_id: string
            }
            Returns: {
              category: string | null
              category_id: string | null
              closes_at: string | null
              compliance_review_state: string | null
              created_at: string
              creator_id: string
              description: string | null
              featured_at: string | null
              group_id: string | null
              id: string
              image_url: string | null
              is_public: boolean | null
              market_category: string | null
              market_type: string | null
              public_feed_allowed: boolean | null
              question: string
              resolution_source: string | null
              resolved_at: string | null
              resolver_type: string | null
              sensitivity_tier: string | null
              status: Database["public"]["Enums"]["market_status"]
              updated_at: string
              winning_option_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "markets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      resolve_market_with_vig: {
        Args: {
          p_market_id: string
          p_vig_percent?: number
          p_winning_option_id: string
        }
        Returns: undefined
      }
      resolve_public_market:
        | {
            Args: { p_market_id: string; p_winning_option_id: string }
            Returns: {
              category: string | null
              category_id: string | null
              closes_at: string | null
              compliance_review_state: string | null
              created_at: string
              creator_id: string
              description: string | null
              featured_at: string | null
              group_id: string | null
              id: string
              image_url: string | null
              is_public: boolean | null
              market_category: string | null
              market_type: string | null
              public_feed_allowed: boolean | null
              question: string
              resolution_source: string | null
              resolved_at: string | null
              resolver_type: string | null
              sensitivity_tier: string | null
              status: Database["public"]["Enums"]["market_status"]
              updated_at: string
              winning_option_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "markets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_evidence_notes?: string
              p_evidence_url?: string
              p_market_id: string
              p_winning_option_id: string
            }
            Returns: {
              category: string | null
              category_id: string | null
              closes_at: string | null
              compliance_review_state: string | null
              created_at: string
              creator_id: string
              description: string | null
              featured_at: string | null
              group_id: string | null
              id: string
              image_url: string | null
              is_public: boolean | null
              market_category: string | null
              market_type: string | null
              public_feed_allowed: boolean | null
              question: string
              resolution_source: string | null
              resolved_at: string | null
              resolver_type: string | null
              sensitivity_tier: string | null
              status: Database["public"]["Enums"]["market_status"]
              updated_at: string
              winning_option_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "markets"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      submit_dispute: {
        Args: { p_evidence_url?: string; p_market_id: string; p_reason: string }
        Returns: {
          admin_response: string | null
          challenger_id: string
          created_at: string
          evidence_url: string | null
          id: string
          market_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_market_like: { Args: { p_market_id: string }; Returns: Json }
      toggle_user_follow: { Args: { p_target_user_id: string }; Returns: Json }
      track_entity_share: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_platform?: string
        }
        Returns: string
      }
      track_market_share: {
        Args: { p_market_id: string; p_platform?: string }
        Returns: string
      }
      transfer_wallet_funds: {
        Args: {
          p_amount: number
          p_client_reference?: string
          p_note?: string
          p_recipient_id: string
        }
        Returns: {
          recipient_balance: number
          recipient_transaction_id: string
          sender_balance: number
          sender_transaction_id: string
        }[]
      }
      update_category: {
        Args: {
          p_category_id: string
          p_color?: string
          p_description?: string
          p_icon?: string
          p_is_active?: boolean
          p_name?: string
          p_sort_order?: number
        }
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_user_phone: {
        Args: { p_phone_e164: string | null }
        Returns: undefined
      }
      upsert_crypto_transaction: {
        Args: {
          p_crypto_amount?: number
          p_crypto_asset?: string
          p_direction: string
          p_fiat_amount?: number
          p_fiat_currency?: string
          p_metadata?: Json
          p_network?: string
          p_provider?: string
          p_provider_event_id?: string
          p_provider_fee?: number
          p_provider_transaction_id: string
          p_refund_wallet_address?: string
          p_status: string
          p_transaction_hash?: string
          p_user_id: string
          p_wallet_address?: string
        }
        Returns: {
          created_at: string
          credited_transaction_id: string | null
          crypto_amount: number | null
          crypto_asset: string | null
          direction: string
          fiat_amount: number | null
          fiat_currency: string
          id: string
          last_webhook_event_id: string | null
          metadata: Json
          network: string | null
          platform_fee: number | null
          provider: string
          provider_fee: number | null
          provider_transaction_id: string
          raw_status: string | null
          refund_wallet_address: string | null
          reserved_transaction_id: string | null
          settled_at: string | null
          status: string
          transaction_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crypto_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_engagement: {
        Args: {
          p_category: string
          p_duration_ms: number
          p_market_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_market_compliance_review: {
        Args: {
          p_category: string
          p_creator_attestation?: boolean
          p_market_id: string
          p_metadata?: Json
          p_resolution_source: string
          p_resolver_type?: string
        }
        Returns: {
          category: string
          created_at: string
          creator_attestation: boolean
          creator_id: string | null
          evidence_requirements: string | null
          id: string
          market_id: string
          metadata: Json
          notes: string | null
          public_feed_allowed: boolean
          reason_code: string | null
          resolution_source: string | null
          resolver_type: string
          review_state: string
          reviewed_at: string | null
          reviewer_id: string | null
          sensitivity_tier: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "market_compliance_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_provider_compliance_status: {
        Args: {
          p_metadata?: Json
          p_provider: string
          p_provider_customer_id?: string
          p_provider_event_id?: string
          p_provider_report_id?: string
          p_provider_session_id: string
          p_status: string
          p_user_id: string
        }
        Returns: {
          completed_at: string | null
          country: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_webhook_event_id: string | null
          metadata: Json
          provider: string
          provider_customer_id: string | null
          provider_report_id: string | null
          provider_session_id: string
          retry_count: number
          status: string
          updated_at: string
          user_id: string
          verification_level: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_verification_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      market_status: "open" | "closed" | "resolved" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      market_status: ["open", "closed", "resolved", "cancelled"],
    },
  },
} as const
