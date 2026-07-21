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
      api_key_usage_log: {
        Row: {
          api_key_id: string
          created_at: string | null
          endpoint: string
          id: string
          ip_address: unknown
          method: string
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          method: string
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          method?: string
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          ip_whitelist: unknown[] | null
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          location_ids: string[] | null
          name: string
          organization_id: string
          permissions: Database["public"]["Enums"]["api_key_permission"][]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          location_ids?: string[] | null
          name: string
          organization_id: string
          permissions?: Database["public"]["Enums"]["api_key_permission"][]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          location_ids?: string[] | null
          name?: string
          organization_id?: string
          permissions?: Database["public"]["Enums"]["api_key_permission"][]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          location_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["invitation_status"] | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          location_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          location_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: Json | null
          contact: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          contact?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          contact?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      plant_catalog: {
        Row: {
          air_purifying: boolean | null
          bloom_season: Json | null
          botanical_name: string
          care_instructions: string | null
          category: string | null
          common_names: Json | null
          created_at: string | null
          difficulty_level: string | null
          fragrant: boolean | null
          growth_rate: string | null
          has_iridescent_leaves: boolean | null
          id: string
          is_hybrid: boolean | null
          light_requirement: string | null
          max_height_cm: number | null
          origin: string | null
          origin_country: string | null
          pet_friendly: boolean | null
          plant_type: string | null
          species: string | null
          updated_at: string | null
          water_frequency: string | null
        }
        Insert: {
          air_purifying?: boolean | null
          bloom_season?: Json | null
          botanical_name: string
          care_instructions?: string | null
          category?: string | null
          common_names?: Json | null
          created_at?: string | null
          difficulty_level?: string | null
          fragrant?: boolean | null
          growth_rate?: string | null
          has_iridescent_leaves?: boolean | null
          id?: string
          is_hybrid?: boolean | null
          light_requirement?: string | null
          max_height_cm?: number | null
          origin?: string | null
          origin_country?: string | null
          pet_friendly?: boolean | null
          plant_type?: string | null
          species?: string | null
          updated_at?: string | null
          water_frequency?: string | null
        }
        Update: {
          air_purifying?: boolean | null
          bloom_season?: Json | null
          botanical_name?: string
          care_instructions?: string | null
          category?: string | null
          common_names?: Json | null
          created_at?: string | null
          difficulty_level?: string | null
          fragrant?: boolean | null
          growth_rate?: string | null
          has_iridescent_leaves?: boolean | null
          id?: string
          is_hybrid?: boolean | null
          light_requirement?: string | null
          max_height_cm?: number | null
          origin?: string | null
          origin_country?: string | null
          pet_friendly?: boolean | null
          plant_type?: string | null
          species?: string | null
          updated_at?: string | null
          water_frequency?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          is_primary: boolean
          organization_id: string
          position: number
          product_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id: string
          position?: number
          product_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string
          position?: number
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory: {
        Row: {
          allow_backorder: boolean | null
          available_quantity: number | null
          id: string
          location_id: string | null
          organization_id: string
          product_id: string
          quantity: number
          reorder_level: number
          reserved_quantity: number
          updated_at: string | null
        }
        Insert: {
          allow_backorder?: boolean | null
          available_quantity?: number | null
          id?: string
          location_id?: string | null
          organization_id: string
          product_id: string
          quantity?: number
          reorder_level?: number
          reserved_quantity?: number
          updated_at?: string | null
        }
        Update: {
          allow_backorder?: boolean | null
          available_quantity?: number | null
          id?: string
          location_id?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          reorder_level?: number
          reserved_quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          compare_price: number | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          dimensions: Json | null
          fragile: boolean | null
          height_cm: number | null
          id: string
          inventory_quantity: number | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          organization_id: string
          plant_catalog_id: string | null
          pot_diameter_cm: number | null
          price: number
          requires_climate_packaging: boolean | null
          shipping_restrictions: Json | null
          short_description: string | null
          size_category: string | null
          sku: string
          slug: string
          status: string | null
          tags: Json | null
          track_inventory: boolean | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          category_id?: string | null
          compare_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          fragile?: boolean | null
          height_cm?: number | null
          id?: string
          inventory_quantity?: number | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          organization_id: string
          plant_catalog_id?: string | null
          pot_diameter_cm?: number | null
          price: number
          requires_climate_packaging?: boolean | null
          shipping_restrictions?: Json | null
          short_description?: string | null
          size_category?: string | null
          sku: string
          slug: string
          status?: string | null
          tags?: Json | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          category_id?: string | null
          compare_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          fragile?: boolean | null
          height_cm?: number | null
          id?: string
          inventory_quantity?: number | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          plant_catalog_id?: string | null
          pot_diameter_cm?: number | null
          price?: number
          requires_climate_packaging?: boolean | null
          shipping_restrictions?: Json | null
          short_description?: string | null
          size_category?: string | null
          sku?: string
          slug?: string
          status?: string | null
          tags?: Json | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_plant_catalog_id_fkey"
            columns: ["plant_catalog_id"]
            isOneToOne: false
            referencedRelation: "plant_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      api_key_has_permission: {
        Args: {
          key_id: string
          required_permission: Database["public"]["Enums"]["api_key_permission"]
        }
        Returns: boolean
      }
      get_user_organization_ids: { Args: never; Returns: string[] }
      get_user_role: {
        Args: { org_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_location_access: { Args: { loc_id: string }; Returns: boolean }
      is_organization_owner: { Args: { org_id: string }; Returns: boolean }
      is_product_available: {
        Args: {
          p_location_id?: string
          p_organization_id: string
          p_product_id: string
        }
        Returns: boolean
      }
      update_api_key_last_used: { Args: { key_id: string }; Returns: undefined }
      validate_api_key_ip: {
        Args: { client_ip: unknown; key_id: string }
        Returns: boolean
      }
    }
    Enums: {
      api_key_permission:
        | "read:products"
        | "write:products"
        | "read:categories"
        | "write:categories"
        | "read:orders"
        | "write:orders"
        | "read:customers"
        | "write:customers"
        | "read:inventory"
        | "write:inventory"
        | "read:users"
        | "write:users"
        | "full_access"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      user_role:
        | "organization_owner"
        | "location_owner"
        | "location_member"
        | "customer"
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
      api_key_permission: [
        "read:products",
        "write:products",
        "read:categories",
        "write:categories",
        "read:orders",
        "write:orders",
        "read:customers",
        "write:customers",
        "read:inventory",
        "write:inventory",
        "read:users",
        "write:users",
        "full_access",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      user_role: [
        "organization_owner",
        "location_owner",
        "location_member",
        "customer",
      ],
    },
  },
} as const
