export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          address_street: string | null
          address_city: string | null
          address_postal_code: string | null
          address_country: string
          phone: string | null
          email: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          address_street?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          address_street?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          role: Database['public']['Enums']['user_role']
          location_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          role?: Database['public']['Enums']['user_role']
          location_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          role?: Database['public']['Enums']['user_role']
          location_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          location_id: string | null
          email: string
          role: Database['public']['Enums']['user_role']
          token: string
          status: Database['public']['Enums']['invitation_status']
          invited_by: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          location_id?: string | null
          email: string
          role: Database['public']['Enums']['user_role']
          token: string
          status?: Database['public']['Enums']['invitation_status']
          invited_by: string
          expires_at: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          location_id?: string | null
          email?: string
          role?: Database['public']['Enums']['user_role']
          token?: string
          status?: Database['public']['Enums']['invitation_status']
          invited_by?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          key_hash: string
          key_prefix: string
          permissions: Database['public']['Enums']['api_key_permission'][]
          location_ids: string[] | null
          ip_whitelist: string[] | null
          last_used_at: string | null
          expires_at: string | null
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          key_hash: string
          key_prefix: string
          permissions?: Database['public']['Enums']['api_key_permission'][]
          location_ids?: string[] | null
          ip_whitelist?: string[] | null
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          key_hash?: string
          key_prefix?: string
          permissions?: Database['public']['Enums']['api_key_permission'][]
          location_ids?: string[] | null
          ip_whitelist?: string[] | null
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      api_key_usage_log: {
        Row: {
          id: string
          api_key_id: string
          endpoint: string
          method: string
          status_code: number | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          api_key_id: string
          endpoint: string
          method: string
          status_code?: number | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          api_key_id?: string
          endpoint?: string
          method?: string
          status_code?: number | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organization_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_user_role: {
        Args: {
          org_id: string
        }
        Returns: Database['public']['Enums']['user_role']
      }
      user_has_location_access: {
        Args: {
          loc_id: string
        }
        Returns: boolean
      }
      is_organization_owner: {
        Args: {
          org_id: string
        }
        Returns: boolean
      }
      api_key_has_permission: {
        Args: {
          key_id: string
          required_permission: Database['public']['Enums']['api_key_permission']
        }
        Returns: boolean
      }
      update_api_key_last_used: {
        Args: {
          key_id: string
        }
        Returns: undefined
      }
      validate_api_key_ip: {
        Args: {
          key_id: string
          client_ip: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'organization_owner' | 'location_owner' | 'location_member' | 'customer'
      invitation_status: 'pending' | 'accepted' | 'expired' | 'revoked'
      api_key_permission: 'read:products' | 'write:products' | 'read:categories' | 'write:categories' | 'read:orders' | 'write:orders' | 'read:customers' | 'write:customers' | 'read:inventory' | 'write:inventory' | 'read:users' | 'write:users' | 'full_access'
    }
  }
}
