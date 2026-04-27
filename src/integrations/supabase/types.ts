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
      app_settings: {
        Row: {
          id: number
          marketing_suspended: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          marketing_suspended?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          marketing_suspended?: boolean
          updated_at?: string
          updated_by?: string | null
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
