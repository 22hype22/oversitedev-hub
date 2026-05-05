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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
          is_super: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_super?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_super?: boolean
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_bot_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_bot_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_bot_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          bot_sales_mode: string
          id: number
          marketing_suspended: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bot_sales_mode?: string
          id?: number
          marketing_suspended?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bot_sales_mode?: string
          id?: number
          marketing_suspended?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bot_active_guilds: {
        Row: {
          bot_id: string
          guild_id: string
          guild_name: string | null
          id: string
          joined_at: string
          last_seen_at: string
          member_count: number | null
          user_id: string
        }
        Insert: {
          bot_id: string
          guild_id: string
          guild_name?: string | null
          id?: string
          joined_at?: string
          last_seen_at?: string
          member_count?: number | null
          user_id: string
        }
        Update: {
          bot_id?: string
          guild_id?: string
          guild_name?: string | null
          id?: string
          joined_at?: string
          last_seen_at?: string
          member_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      bot_addon_overrides: {
        Row: {
          addon_id: string
          included: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          addon_id: string
          included?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          addon_id?: string
          included?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bot_addon_state: {
        Row: {
          addon_id: string
          bot_id: string
          enabled: boolean
          updated_at: string
        }
        Insert: {
          addon_id: string
          bot_id: string
          enabled?: boolean
          updated_at?: string
        }
        Update: {
          addon_id?: string
          bot_id?: string
          enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_addon_state_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_build_jobs: {
        Row: {
          artifact_url: string | null
          attempts: number
          build_log: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          delivery_url: string | null
          error_message: string | null
          id: string
          order_id: string
          selections: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          artifact_url?: string | null
          attempts?: number
          build_log?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_url?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          selections?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          artifact_url?: string | null
          attempts?: number
          build_log?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_url?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          selections?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_build_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_channel_cache: {
        Row: {
          bot_id: string
          channel_id: string
          channel_name: string
          channel_type: string
          fetched_at: string
          guild_id: string
          id: string
          parent_id: string | null
          parent_name: string | null
          parent_position: number
          position: number
          user_id: string
        }
        Insert: {
          bot_id: string
          channel_id: string
          channel_name: string
          channel_type?: string
          fetched_at?: string
          guild_id: string
          id?: string
          parent_id?: string | null
          parent_name?: string | null
          parent_position?: number
          position?: number
          user_id: string
        }
        Update: {
          bot_id?: string
          channel_id?: string
          channel_name?: string
          channel_type?: string
          fetched_at?: string
          guild_id?: string
          id?: string
          parent_id?: string | null
          parent_name?: string | null
          parent_position?: number
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      bot_commands: {
        Row: {
          action: string
          bot_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          requested_by: string
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          action: string
          bot_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          requested_by: string
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          action?: string
          bot_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          requested_by?: string
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      bot_config: {
        Row: {
          applied_at: string | null
          bot_id: string
          config: Json
          created_at: string | null
          feature: string
          id: string
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          bot_id: string
          config?: Json
          created_at?: string | null
          feature: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          bot_id?: string
          config?: Json
          created_at?: string | null
          feature?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_config_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_credits: {
        Row: {
          balance_cents: number
          bot_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          bot_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          bot_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_dashboard_redemptions: {
        Row: {
          bot_id: string
          code: string
          code_type: string
          credit_added_cents: number | null
          discount_code_id: string | null
          free_period_code_id: string | null
          id: string
          months_granted: number | null
          percent_off: number | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          code: string
          code_type: string
          credit_added_cents?: number | null
          discount_code_id?: string | null
          free_period_code_id?: string | null
          id?: string
          months_granted?: number | null
          percent_off?: number | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          code?: string
          code_type?: string
          credit_added_cents?: number | null
          discount_code_id?: string | null
          free_period_code_id?: string | null
          id?: string
          months_granted?: number | null
          percent_off?: number | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_free_period_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          months: number
          notes: string | null
          times_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          months?: number
          notes?: string | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          months?: number
          notes?: string | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_free_period_redemptions: {
        Row: {
          bot_id: string
          code_id: string
          id: string
          months_granted: number
          new_free_until: string
          previous_free_until: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          code_id: string
          id?: string
          months_granted: number
          new_free_until: string
          previous_free_until?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          code_id?: string
          id?: string
          months_granted?: number
          new_free_until?: string
          previous_free_until?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_free_period_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "bot_free_period_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_free_periods: {
        Row: {
          bot_id: string
          created_at: string
          free_until: string
          id: string
          reminder_sent_at: string | null
          resumed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          free_until: string
          id?: string
          reminder_sent_at?: string | null
          resumed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          free_until?: string
          id?: string
          reminder_sent_at?: string | null
          resumed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_logs: {
        Row: {
          bot_id: string
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          user_id: string
        }
        Insert: {
          bot_id: string
          context?: Json | null
          created_at?: string
          id?: string
          level: string
          message: string
          user_id: string
        }
        Update: {
          bot_id?: string
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_notifications: {
        Row: {
          attempts: number
          body: string
          bot_id: string | null
          context: Json | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          read_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          bot_id?: string | null
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          read_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          bot_id?: string | null
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          read_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_orders: {
        Row: {
          addons: string[]
          banner_url: string | null
          base: string
          bot_description: string | null
          bot_name: string
          created_at: string
          currency: string
          delivery_url: string | null
          discount_amount: number
          discount_code: string | null
          engine_version: string
          icon_url: string | null
          id: string
          installment_amount: number | null
          monthly_hosting: boolean
          notes: string | null
          paid_at: string | null
          payment_plan: string
          plan_months: number | null
          purchase_id: string | null
          source_url: string | null
          status: string
          stripe_session_id: string | null
          submitted_at: string | null
          subscription_id: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          addons?: string[]
          banner_url?: string | null
          base: string
          bot_description?: string | null
          bot_name: string
          created_at?: string
          currency?: string
          delivery_url?: string | null
          discount_amount?: number
          discount_code?: string | null
          engine_version?: string
          icon_url?: string | null
          id?: string
          installment_amount?: number | null
          monthly_hosting?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_plan?: string
          plan_months?: number | null
          purchase_id?: string | null
          source_url?: string | null
          status?: string
          stripe_session_id?: string | null
          submitted_at?: string | null
          subscription_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          addons?: string[]
          banner_url?: string | null
          base?: string
          bot_description?: string | null
          bot_name?: string
          created_at?: string
          currency?: string
          delivery_url?: string | null
          discount_amount?: number
          discount_code?: string | null
          engine_version?: string
          icon_url?: string | null
          id?: string
          installment_amount?: number | null
          monthly_hosting?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_plan?: string
          plan_months?: number | null
          purchase_id?: string | null
          source_url?: string | null
          status?: string
          stripe_session_id?: string | null
          submitted_at?: string | null
          subscription_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_pending_discounts: {
        Row: {
          applied_at: string | null
          bot_id: string
          created_at: string
          discount_code_id: string | null
          id: string
          percent_off: number
          source: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          bot_id: string
          created_at?: string
          discount_code_id?: string | null
          id?: string
          percent_off: number
          source?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          bot_id?: string
          created_at?: string
          discount_code_id?: string | null
          id?: string
          percent_off?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_role_cache: {
        Row: {
          bot_id: string
          color: number
          fetched_at: string
          guild_id: string
          id: string
          is_everyone: boolean
          managed: boolean
          position: number
          role_id: string
          role_name: string
          user_id: string
        }
        Insert: {
          bot_id: string
          color?: number
          fetched_at?: string
          guild_id: string
          id?: string
          is_everyone?: boolean
          managed?: boolean
          position?: number
          role_id: string
          role_name: string
          user_id: string
        }
        Update: {
          bot_id?: string
          color?: number
          fetched_at?: string
          guild_id?: string
          id?: string
          is_everyone?: boolean
          managed?: boolean
          position?: number
          role_id?: string
          role_name?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_runtime_status: {
        Row: {
          bot_id: string
          created_at: string
          details: Json | null
          id: string
          last_error: string | null
          last_error_at: string | null
          last_heartbeat_at: string | null
          last_offline_alert_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          uptime_seconds: number
          user_id: string
          version: string | null
          worker_id: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          details?: Json | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_heartbeat_at?: string | null
          last_offline_alert_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          uptime_seconds?: number
          user_id: string
          version?: string | null
          worker_id?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_heartbeat_at?: string | null
          last_offline_alert_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          uptime_seconds?: number
          user_id?: string
          version?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      bot_secret_slots: {
        Row: {
          addon_id: string
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          key: string
          label: string
          placeholder: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          key: string
          label: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_secrets: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          key: string
          last_four: string
          managed: boolean
          updated_at: string
          user_id: string
          value_encrypted: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          key: string
          last_four?: string
          managed?: boolean
          updated_at?: string
          user_id: string
          value_encrypted: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          key?: string
          last_four?: string
          managed?: boolean
          updated_at?: string
          user_id?: string
          value_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_secrets_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_server_slots: {
        Row: {
          bot_id: string
          created_at: string
          current_period_end: string | null
          extra_slots: number
          id: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          current_period_end?: string | null
          extra_slots?: number
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          current_period_end?: string | null
          extra_slots?: number
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_token_pool: {
        Row: {
          assigned_at: string | null
          assigned_bot_id: string | null
          bot_username: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          status: string
          token_encrypted: string
          token_last_four: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_bot_id?: string | null
          bot_username: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          token_encrypted: string
          token_last_four: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_bot_id?: string | null
          bot_username?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          token_encrypted?: string
          token_last_four?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_token_pool_assigned_bot_id_fkey"
            columns: ["assigned_bot_id"]
            isOneToOne: false
            referencedRelation: "bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_usage_metrics: {
        Row: {
          active_servers: number
          bot_id: string
          bucket_start: string
          commands_count: number
          created_at: string
          errors_count: number
          id: string
          last_error_alert_at: string | null
          member_count: number
          messages_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_servers?: number
          bot_id: string
          bucket_start: string
          commands_count?: number
          created_at?: string
          errors_count?: number
          id?: string
          last_error_alert_at?: string | null
          member_count?: number
          messages_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_servers?: number
          bot_id?: string
          bucket_start?: string
          commands_count?: number
          created_at?: string
          errors_count?: number
          id?: string
          last_error_alert_at?: string | null
          member_count?: number
          messages_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_addon_order: {
        Row: {
          bot_id: string
          group_key: string
          id: string
          ordered_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          group_key: string
          id?: string
          ordered_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          group_key?: string
          id?: string
          ordered_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_fixes: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_uses: number | null
          notes: string | null
          times_used: number
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_uses?: number | null
          notes?: string | null
          times_used?: number
          updated_at?: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_uses?: number | null
          notes?: string | null
          times_used?: number
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notification_rate_limits: {
        Row: {
          bucket_start: string
          count: number
          kind: string
          user_id: string
        }
        Insert: {
          bucket_start: string
          count?: number
          kind: string
          user_id: string
        }
        Update: {
          bucket_start?: string
          count?: number
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_purchases: {
        Row: {
          created_at: string
          fulfilled_at: string | null
          gamepass_id: string
          id: string
          product_id: string
          purchase_type: string
          roblox_user_id: number
          roblox_username: string
          status: string
          version: string | null
        }
        Insert: {
          created_at?: string
          fulfilled_at?: string | null
          gamepass_id: string
          id?: string
          product_id: string
          purchase_type?: string
          roblox_user_id: number
          roblox_username: string
          status?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          fulfilled_at?: string | null
          gamepass_id?: string
          id?: string
          product_id?: string
          purchase_type?: string
          roblox_user_id?: number
          roblox_username?: string
          status?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          category: string
          created_at: string
          current_version: string | null
          description: string | null
          emoji: string | null
          gamepass_id: string | null
          gamepass_url: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          is_available: boolean
          name: string
          price: number
          price_robux: number | null
          updated_at: string
          upgrade_gamepass_id: string | null
          upgrade_gamepass_url: string | null
          upgrade_price: number | null
          upgrade_price_robux: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id: string
          image_url?: string | null
          image_urls?: string[]
          is_available?: boolean
          name: string
          price?: number
          price_robux?: number | null
          updated_at?: string
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_available?: boolean
          name?: string
          price?: number
          price_robux?: number | null
          updated_at?: string
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_versions: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          product_id: string
          version: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          product_id: string
          version: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          product_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          current_version: string | null
          description: string | null
          emoji: string | null
          file_name: string | null
          file_url: string | null
          gamepass_id: string | null
          gamepass_url: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          is_available: boolean
          name: string
          price: number
          price_robux: number | null
          updated_at: string
          upgrade_gamepass_id: string | null
          upgrade_gamepass_url: string | null
          upgrade_price: number | null
          upgrade_price_robux: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          file_name?: string | null
          file_url?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_available?: boolean
          name: string
          price?: number
          price_robux?: number | null
          updated_at?: string
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          file_name?: string | null
          file_url?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          is_available?: boolean
          name?: string
          price?: number
          price_robux?: number | null
          updated_at?: string
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          discord_username: string
          id: string
          is_banned: boolean
          notify_discord: boolean
          notify_email: boolean
          preferred_contact: string
          preferred_currency: string
          preferred_language: string
          roblox_username: string
          timezone: string
          updated_at: string
          user_id: string
          welcome_discount_available: boolean
        }
        Insert: {
          created_at?: string
          discord_username: string
          id?: string
          is_banned?: boolean
          notify_discord?: boolean
          notify_email?: boolean
          preferred_contact?: string
          preferred_currency?: string
          preferred_language?: string
          roblox_username: string
          timezone?: string
          updated_at?: string
          user_id: string
          welcome_discount_available?: boolean
        }
        Update: {
          created_at?: string
          discord_username?: string
          id?: string
          is_banned?: boolean
          notify_discord?: boolean
          notify_email?: boolean
          preferred_contact?: string
          preferred_currency?: string
          preferred_language?: string
          roblox_username?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          welcome_discount_available?: boolean
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          email: string | null
          environment: string
          file_name: string | null
          file_url: string | null
          id: string
          parent_purchase_id: string | null
          product_id: string | null
          product_name: string
          purchase_type: string
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string | null
          version: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          email?: string | null
          environment?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          parent_purchase_id?: string | null
          product_id?: string | null
          product_name: string
          purchase_type?: string
          status?: string
          stripe_session_id: string
          updated_at?: string
          user_id?: string | null
          version?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          email?: string | null
          environment?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          parent_purchase_id?: string | null
          product_id?: string | null
          product_name?: string
          purchase_type?: string
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_parent_purchase_id_fkey"
            columns: ["parent_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_access_audit: {
        Row: {
          action: string
          admin_user_id: string
          bot_id: string | null
          created_at: string
          details: Json | null
          grant_id: string
          id: string
          owner_user_id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          bot_id?: string | null
          created_at?: string
          details?: Json | null
          grant_id: string
          id?: string
          owner_user_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          bot_id?: string | null
          created_at?: string
          details?: Json | null
          grant_id?: string
          id?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_audit_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "support_access_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          notes: string | null
          owner_user_id: string
          redeemed_at: string | null
          redeemed_by_admin_id: string | null
          revoked_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          notes?: string | null
          owner_user_id: string
          redeemed_at?: string | null
          redeemed_by_admin_id?: string | null
          revoked_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          owner_user_id?: string
          redeemed_at?: string | null
          redeemed_by_admin_id?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      support_access_grants: {
        Row: {
          admin_user_id: string
          code_id: string
          expires_at: string
          granted_at: string
          id: string
          owner_user_id: string
          revoked_at: string | null
        }
        Insert: {
          admin_user_id: string
          code_id: string
          expires_at: string
          granted_at?: string
          id?: string
          owner_user_id: string
          revoked_at?: string | null
        }
        Update: {
          admin_user_id?: string
          code_id?: string
          expires_at?: string
          granted_at?: string
          id?: string
          owner_user_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_access_grants_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "support_access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_notification_prefs: {
        Row: {
          created_at: string
          discord_linked_at: string | null
          discord_user_id: string | null
          discord_username: string | null
          error_spike_threshold: number
          notify_bot_offline: boolean
          notify_command_finished: boolean
          notify_error_spike: boolean
          notify_free_period_expiring: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_linked_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          error_spike_threshold?: number
          notify_bot_offline?: boolean
          notify_command_finished?: boolean
          notify_error_spike?: boolean
          notify_free_period_expiring?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_linked_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          error_spike_threshold?: number
          notify_bot_offline?: boolean
          notify_command_finished?: boolean
          notify_error_spike?: boolean
          notify_free_period_expiring?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_tokens: {
        Row: {
          bot_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          notes: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          notes?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          notes?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_products: {
        Row: {
          category: string | null
          created_at: string | null
          current_version: string | null
          description: string | null
          emoji: string | null
          gamepass_id: string | null
          gamepass_url: string | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          is_available: boolean | null
          name: string | null
          price: number | null
          price_robux: number | null
          updated_at: string | null
          upgrade_gamepass_id: string | null
          upgrade_gamepass_url: string | null
          upgrade_price: number | null
          upgrade_price_robux: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id?: string | null
          image_url?: string | null
          image_urls?: string[] | null
          is_available?: boolean | null
          name?: string | null
          price?: number | null
          price_robux?: number | null
          updated_at?: string | null
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_version?: string | null
          description?: string | null
          emoji?: string | null
          gamepass_id?: string | null
          gamepass_url?: string | null
          id?: string | null
          image_url?: string | null
          image_urls?: string[] | null
          is_available?: boolean | null
          name?: string | null
          price?: number | null
          price_robux?: number | null
          updated_at?: string | null
          upgrade_gamepass_id?: string | null
          upgrade_gamepass_url?: string | null
          upgrade_price?: number | null
          upgrade_price_robux?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _bot_secrets_key: { Args: never; Returns: string }
      _enqueue_bot_notification: {
        Args: {
          _body: string
          _bot_id: string
          _context?: Json
          _event_type: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      _worker_token_lookup: {
        Args: { _token: string }
        Returns: {
          bot_id: string
          token_id: string
        }[]
      }
      add_bot_token_to_pool: {
        Args: {
          _bot_username: string
          _client_id: string
          _notes?: string
          _token: string
        }
        Returns: Json
      }
      admin_set_bot_extra_slots: {
        Args: { _bot_id: string; _extra_slots: number }
        Returns: Json
      }
      assign_pool_token_to_bot: { Args: { _bot_id: string }; Returns: Json }
      claim_bot_token_from_pool: { Args: { _order_id: string }; Returns: Json }
      cleanup_old_bot_logs: { Args: never; Returns: number }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_old_usage_metrics: { Args: never; Returns: number }
      consume_notification_rate: {
        Args: { _kind: string; _max?: number }
        Returns: Json
      }
      create_support_access_code: {
        Args: { _expires_in_hours: number; _notes?: string }
        Returns: Json
      }
      create_worker_token: {
        Args: { _bot_id?: string; _name: string; _notes?: string }
        Returns: Json
      }
      delete_bot_secret: {
        Args: { _bot_id: string; _key: string }
        Returns: Json
      }
      delete_bot_token_pool_entry: { Args: { _id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_stale_bots: { Args: never; Returns: number }
      enqueue_apply_config: {
        Args: { _bot_id: string; _feature: string }
        Returns: Json
      }
      enqueue_bot_command: {
        Args: { _action: string; _bot_id: string }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_free_period_expiring_alerts: { Args: never; Returns: number }
      get_bot_client_id: { Args: { _bot_id: string }; Returns: string }
      get_bot_health: { Args: { _bot_id: string }; Returns: Json }
      get_bot_secrets_metadata: {
        Args: { _bot_id: string }
        Returns: {
          addon_id: string
          description: string
          is_managed: boolean
          is_required: boolean
          is_set: boolean
          key: string
          label: string
          last_four: string
          placeholder: string
          sort_order: number
          updated_at: string
        }[]
      }
      get_bot_server_limit: { Args: { _bot_id: string }; Returns: Json }
      get_bot_usage_daily: {
        Args: { _bot_id: string; _days?: number }
        Returns: {
          avg_active_servers: number
          commands_count: number
          day: string
          errors_count: number
          max_member_count: number
          messages_count: number
        }[]
      }
      get_total_members_serving: { Args: never; Returns: number }
      has_active_membership: {
        Args: { _env?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_support_access: {
        Args: { _admin_id: string; _owner_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _target_bot_id?: string
          _target_user_id?: string
        }
        Returns: string
      }
      log_support_action: {
        Args: {
          _action: string
          _bot_id?: string
          _details?: Json
          _grant_id: string
        }
        Returns: undefined
      }
      mark_bot_notifications_read: {
        Args: { _ids?: string[] }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_bot_code: {
        Args: { _bot_id: string; _code: string }
        Returns: Json
      }
      redeem_bot_free_period_code: {
        Args: { _bot_id: string; _code: string }
        Returns: Json
      }
      redeem_support_access_code: { Args: { _code: string }; Returns: Json }
      request_list_channels: {
        Args: { _bot_id: string; _guild_id: string }
        Returns: Json
      }
      request_list_guilds: { Args: { _bot_id: string }; Returns: Json }
      request_list_roles: {
        Args: { _bot_id: string; _guild_id: string }
        Returns: Json
      }
      reveal_bot_secret: {
        Args: { _bot_id: string; _key: string; _password?: string }
        Returns: Json
      }
      reveal_bot_token_pool_entry: { Args: { _id: string }; Returns: Json }
      revoke_support_access_code: { Args: { _code_id: string }; Returns: Json }
      revoke_support_access_grant: {
        Args: { _grant_id: string }
        Returns: Json
      }
      revoke_worker_token: { Args: { _id: string }; Returns: Json }
      runtime_append_bot_log:
        | {
            Args: {
              _bot_id: string
              _context?: Json
              _level: string
              _message: string
            }
            Returns: string
          }
        | {
            Args: {
              _bot_id: string
              _context?: Json
              _level: string
              _message: string
              _token: string
            }
            Returns: Json
          }
      runtime_claim_build_job: {
        Args: { _token: string; _worker_id: string }
        Returns: Json
      }
      runtime_claim_next_command: {
        Args: { _token: string; _worker_id?: string }
        Returns: Json
      }
      runtime_complete_command: {
        Args: {
          _command_id: string
          _error?: string
          _status: string
          _token: string
        }
        Returns: Json
      }
      runtime_enqueue_notification: {
        Args: {
          _body: string
          _bot_id: string
          _context?: Json
          _event_type: string
          _title: string
          _token: string
        }
        Returns: Json
      }
      runtime_fail_build: {
        Args: {
          _bot_order_id: string
          _build_log: string
          _job_id: string
          _token: string
        }
        Returns: Json
      }
      runtime_finalize_build: {
        Args: {
          _addons: string[]
          _banner_url: string
          _base: string
          _bot_description: string
          _bot_name: string
          _bot_order_id: string
          _build_log: string
          _icon_url: string
          _job_id: string
          _token: string
        }
        Returns: Json
      }
      runtime_get_bot_secret:
        | { Args: { _bot_id: string; _key: string }; Returns: string }
        | {
            Args: { _bot_id: string; _key: string; _token: string }
            Returns: string
          }
      runtime_load_bot_config: {
        Args: { _bot_id: string; _token: string }
        Returns: Json
      }
      runtime_record_bot_metrics:
        | {
            Args: {
              _active_servers?: number
              _bot_id: string
              _commands_delta?: number
              _errors_delta?: number
              _member_count?: number
              _messages_delta?: number
            }
            Returns: Json
          }
        | {
            Args: {
              _active_servers?: number
              _bot_id: string
              _commands_delta?: number
              _errors_delta?: number
              _member_count?: number
              _messages_delta?: number
              _token: string
            }
            Returns: Json
          }
      runtime_release_stale_commands: { Args: never; Returns: number }
      runtime_remove_bot_guild:
        | { Args: { _bot_id: string; _guild_id: string }; Returns: Json }
        | {
            Args: { _bot_id: string; _guild_id: string; _token: string }
            Returns: Json
          }
      runtime_replace_bot_guilds: {
        Args: { _bot_id: string; _guilds: Json; _token: string }
        Returns: Json
      }
      runtime_seed_secret_slots: {
        Args: { _slots: Json; _token: string }
        Returns: Json
      }
      runtime_set_bot_status:
        | {
            Args: {
              _bot_id: string
              _details?: Json
              _last_error?: string
              _status: string
              _version?: string
              _worker_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _bot_id: string
              _details?: Json
              _last_error?: string
              _status: string
              _token: string
              _version?: string
              _worker_id?: string
            }
            Returns: Json
          }
      runtime_upsert_bot_channels: {
        Args: {
          _bot_id: string
          _channels: Json
          _guild_id: string
          _token: string
        }
        Returns: Json
      }
      runtime_upsert_bot_guild:
        | {
            Args: {
              _bot_id: string
              _guild_id: string
              _guild_name?: string
              _member_count?: number
            }
            Returns: Json
          }
        | {
            Args: {
              _bot_id: string
              _guild_id: string
              _guild_name?: string
              _member_count?: number
              _token: string
            }
            Returns: Json
          }
      runtime_upsert_bot_roles: {
        Args: {
          _bot_id: string
          _guild_id: string
          _roles: Json
          _token: string
        }
        Returns: Json
      }
      set_bot_config_enabled: {
        Args: { _bot_id: string; _enabled: boolean; _feature: string }
        Returns: undefined
      }
      set_bot_secret: {
        Args: { _bot_id: string; _key: string; _value: string }
        Returns: Json
      }
      update_bot_token_pool_entry:
        | {
            Args: {
              _assigned_bot_id?: string
              _bot_username?: string
              _id: string
              _notes?: string
              _status?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _assigned_bot_id?: string
              _bot_username?: string
              _client_id?: string
              _id: string
              _notes?: string
              _status?: string
              _token?: string
            }
            Returns: Json
          }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
