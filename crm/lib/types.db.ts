// Generated from the live Supabase schema (migration: initial_crm_schema).
// Regenerate with: `mcp__supabase__generate_typescript_types` (or
// `supabase gen types typescript`). DO NOT hand-edit — this is the raw DB
// contract. The hand-written UI contract lives in `lib/types.ts`; the mapping
// between the two lives in `lib/db/mappers.ts`.
//
// Source of truth: project xwsmovmtfymiqvgjicfk (eu-north-1).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          address: string | null
          assigned_rep_id: string | null
          assigned_tam_id: string | null
          country: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          assigned_rep_id?: string | null
          assigned_tam_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          assigned_rep_id?: string | null
          assigned_tam_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      activity_timeline: {
        Row: {
          account_id: string
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["activity_entity_type"] | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          account_id: string
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["activity_entity_type"] | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: Partial<Database["public"]["Tables"]["activity_timeline"]["Insert"]>
        Relationships: []
      }
      cases: {
        Row: {
          account_id: string
          assigned_tam_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          is_escalated_to_third_party: boolean
          priority: Database["public"]["Enums"]["case_priority"]
          resolved_at: string | null
          service_id: string | null
          sla_due_date: string | null
          status: Database["public"]["Enums"]["case_status"]
          third_party_reference: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_tam_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_escalated_to_third_party?: boolean
          priority?: Database["public"]["Enums"]["case_priority"]
          resolved_at?: string | null
          service_id?: string | null
          sla_due_date?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          third_party_reference?: string | null
          title: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["cases"]["Insert"]>
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          job_title: string | null
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>
        Relationships: []
      }
      deal_confidence_overrides: {
        Row: {
          deal_id: string
          id: string
          reason: string | null
          set_at: string
          set_by: string | null
          value: number
        }
        Insert: {
          deal_id: string
          id?: string
          reason?: string | null
          set_at?: string
          set_by?: string | null
          value: number
        }
        Update: Partial<Database["public"]["Tables"]["deal_confidence_overrides"]["Insert"]>
        Relationships: []
      }
      forecast_targets: {
        Row: {
          amount_eur: number
          created_at: string
          id: string
          period: string
          updated_at: string
        }
        Insert: {
          amount_eur?: number
          created_at?: string
          id?: string
          period: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["forecast_targets"]["Insert"]>
        Relationships: []
      }
      deal_forecast_phases: {
        Row: {
          created_at: string
          deal_id: string
          device_unit_price: number | null
          device_units: number
          id: string
          period_label: string
          period_start: string
          service_revenue: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          device_unit_price?: number | null
          device_units?: number
          id?: string
          period_label: string
          period_start: string
          service_revenue?: number
        }
        Update: Partial<Database["public"]["Tables"]["deal_forecast_phases"]["Insert"]>
        Relationships: []
      }
      deals: {
        Row: {
          account_id: string
          channel: Database["public"]["Enums"]["deal_channel"]
          created_at: string
          device_unit_price: number | null
          expected_close_date: string | null
          id: string
          last_activity_at: string
          lost_reason: string | null
          owner_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          win_probability: number | null
        }
        Insert: {
          account_id: string
          channel: Database["public"]["Enums"]["deal_channel"]
          created_at?: string
          device_unit_price?: number | null
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string
          lost_reason?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          win_probability?: number | null
        }
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>
        Relationships: []
      }
      notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["note_entity_type"]
          id: string
          is_internal: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["note_entity_type"]
          id?: string
          is_internal?: boolean
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["notification_entity_type"] | null
          id: string
          is_read: boolean
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["notification_entity_type"] | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>
        Relationships: []
      }
      offer_approvals: {
        Row: {
          approval_role: Database["public"]["Enums"]["approval_role"]
          approver_id: string | null
          comment: string | null
          created_at: string
          id: string
          offer_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          approval_role: Database["public"]["Enums"]["approval_role"]
          approver_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          offer_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: Partial<Database["public"]["Tables"]["offer_approvals"]["Insert"]>
        Relationships: []
      }
      offer_line_items: {
        Row: {
          created_at: string
          description: string
          discount_pct: number
          id: string
          invoicing_model: Database["public"]["Enums"]["invoicing_model"] | null
          item_type: string
          offer_id: string
          product_id: string | null
          quantity: number
          service_id: string | null
          term_years: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_pct?: number
          id?: string
          invoicing_model?: Database["public"]["Enums"]["invoicing_model"] | null
          item_type: string
          offer_id: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          term_years?: number | null
          unit_price: number
        }
        Update: Partial<Database["public"]["Tables"]["offer_line_items"]["Insert"]>
        Relationships: []
      }
      offers: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          discount_justification: string | null
          discount_pct: number
          id: string
          locked_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          title: string
          total_discounted_value: number | null
          total_list_value: number | null
          updated_at: string
          version: number
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          discount_justification?: string | null
          discount_pct?: number
          id?: string
          locked_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title: string
          total_discounted_value?: number | null
          total_list_value?: number | null
          updated_at?: string
          version?: number
        }
        Update: Partial<Database["public"]["Tables"]["offers"]["Insert"]>
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sku: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      services: {
        Row: {
          base_price: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          invoicing_model: Database["public"]["Enums"]["invoicing_model"]
          is_active: boolean
          monthly_rate: number | null
          name: string
          service_type: Database["public"]["Enums"]["service_type"]
          term_years: number | null
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoicing_model: Database["public"]["Enums"]["invoicing_model"]
          is_active?: boolean
          monthly_rate?: number | null
          name: string
          service_type?: Database["public"]["Enums"]["service_type"]
          term_years?: number | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_manager_or_finance: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      activity_entity_type:
        | "deal"
        | "case"
        | "offer"
        | "contact"
        | "account"
        | "note"
      approval_role: "sales_manager" | "finance"
      approval_status: "pending" | "approved" | "rejected"
      case_priority: "low" | "medium" | "high" | "critical"
      case_status: "open" | "in_progress" | "escalated" | "resolved" | "closed"
      deal_channel: "direct" | "reseller"
      deal_stage:
        | "interest_shown"
        | "rfi_answered"
        | "rfp_offer_given"
        | "customer_test"
        | "contract_negotiation"
        | "won"
        | "lost"
      invoicing_model: "one_off" | "fixed_term" | "monthly_recurring"
      note_entity_type: "deal" | "case" | "account"
      notification_entity_type: "deal" | "case" | "offer" | "account"
      offer_status:
        | "draft"
        | "pending_sm_approval"
        | "pending_finance_approval"
        | "approved"
        | "rejected"
        | "locked"
        | "sent"
      service_type: "internal" | "third_party"
      user_role: "rep" | "tam" | "sales_manager" | "finance"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
