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
    PostgrestVersion: "14.15"
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
      activities: {
        Row: {
          body: string | null
          created_by: string | null
          from_stage_id: string | null
          id: string
          lead_id: string
          occurred_at: string
          tenant_id: string
          to_stage_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          body?: string | null
          created_by?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id: string
          occurred_at?: string
          tenant_id: string
          to_stage_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          body?: string | null
          created_by?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          occurred_at?: string
          tenant_id?: string
          to_stage_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_from_stage_fkey"
            columns: ["from_stage_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "activities_lead_fkey"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_to_stage_fkey"
            columns: ["to_stage_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attempt: number
          automation_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          lead_id: string
          request_id: number | null
          run_after: string
          skip_reason: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          attempt?: number
          automation_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          lead_id: string
          request_id?: number | null
          run_after?: string
          skip_reason?: string | null
          status: string
          tenant_id: string
        }
        Update: {
          attempt?: number
          automation_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          lead_id?: string
          request_id?: number | null
          run_after?: string
          skip_reason?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_lead_fkey"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action: Database["public"]["Enums"]["automation_action"]
          config: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          idle_days: number | null
          stage_id: string
          suspended_at: string | null
          tenant_id: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Insert: {
          action: Database["public"]["Enums"]["automation_action"]
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          idle_days?: number | null
          stage_id: string
          suspended_at?: string | null
          tenant_id: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Update: {
          action?: Database["public"]["Enums"]["automation_action"]
          config?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          idle_days?: number | null
          stage_id?: string
          suspended_at?: string | null
          tenant_id?: string
          trigger?: Database["public"]["Enums"]["automation_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_stage_fkey"
            columns: ["stage_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number | null
          id: string
          is_demo: boolean
          lost_reason: string | null
          name: string
          phone: string | null
          sort_order: number
          source: Database["public"]["Enums"]["lead_source"]
          stage_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          is_demo?: boolean
          lost_reason?: string | null
          name: string
          phone?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          is_demo?: boolean
          lost_reason?: string | null
          name?: string
          phone?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["lead_source"]
          stage_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_fkey"
            columns: ["stage_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          archived_at: string | null
          created_at: string
          drift_days: number | null
          expects_reply: boolean
          guidance: string | null
          id: string
          is_system: boolean
          kind: Database["public"]["Enums"]["stage_kind"]
          meaning: string | null
          name: string
          position: number
          short_name: string | null
          swatch: string
          tenant_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          drift_days?: number | null
          expects_reply?: boolean
          guidance?: string | null
          id?: string
          is_system?: boolean
          kind?: Database["public"]["Enums"]["stage_kind"]
          meaning?: string | null
          name: string
          position: number
          short_name?: string | null
          swatch?: string
          tenant_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          drift_days?: number | null
          expects_reply?: boolean
          guidance?: string | null
          id?: string
          is_system?: boolean
          kind?: Database["public"]["Enums"]["stage_kind"]
          meaning?: string | null
          name?: string
          position?: number
          short_name?: string | null
          swatch?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      qualification_answers: {
        Row: {
          answer: Database["public"]["Enums"]["qualification_answer"]
          answered_at: string
          answered_by: string | null
          item: Database["public"]["Enums"]["checklist_item"]
          lead_id: string
          tenant_id: string
        }
        Insert: {
          answer: Database["public"]["Enums"]["qualification_answer"]
          answered_at?: string
          answered_by?: string | null
          item: Database["public"]["Enums"]["checklist_item"]
          lead_id: string
          tenant_id: string
        }
        Update: {
          answer?: Database["public"]["Enums"]["qualification_answer"]
          answered_at?: string
          answered_by?: string | null
          item?: Database["public"]["Enums"]["checklist_item"]
          lead_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_answers_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_answers_lead_fkey"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "qualification_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assigned_to: string | null
          created_at: string
          done_at: string | null
          due_at: string
          id: string
          lead_id: string
          tenant_id: string
          title: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          done_at?: string | null
          due_at: string
          id?: string
          lead_id: string
          tenant_id: string
          title?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          done_at?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_fkey"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_stage: {
        Args: { p_destination_id?: string; p_stage_id: string }
        Returns: undefined
      }
      create_lead: {
        Args: {
          p_company?: string
          p_email?: string
          p_estimated_value?: number
          p_name: string
          p_phone?: string
          p_source?: Database["public"]["Enums"]["lead_source"]
          p_stage_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      fire_automation_run: { Args: { p_run_id: string }; Returns: undefined }
      lead_stats: { Args: { p_tenant_id: string }; Returns: Json }
      mint_webhook_secret: {
        Args: { p_automation_id: string }
        Returns: string
      }
      reorder_stages: {
        Args: { p_stage_ids: string[]; p_tenant_id: string }
        Returns: undefined
      }
      run_stage_automations: {
        Args: {
          p_activity_id: string
          p_depth?: number
          p_lead_id: string
          p_stage_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_lead: {
        Args: {
          p_answers?: Json
          p_company: string
          p_email: string
          p_estimated_value: number
          p_lead_id: string
          p_lost_reason?: string
          p_name: string
          p_note?: string
          p_note_type?: Database["public"]["Enums"]["activity_type"]
          p_phone: string
          p_reminder_action?: string
          p_reminder_due?: string
          p_reminder_title?: string
          p_source: Database["public"]["Enums"]["lead_source"]
          p_stage_id: string
        }
        Returns: undefined
      }
      sweep_due_tier_a_runs: { Args: never; Returns: undefined }
      webhook_url_check: { Args: { p_url: string }; Returns: string }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note" | "status_changed"
      automation_action:
        | "set_reminder"
        | "assign_member"
        | "add_note"
        | "suggest_advance"
        | "webhook"
      automation_trigger: "lead_enters_stage" | "lead_idle_in_stage"
      checklist_item: "interest" | "need" | "budget" | "authority" | "timeline"
      lead_source: "website" | "referral" | "social_media" | "phone" | "other"
      member_role: "owner" | "member"
      qualification_answer: "yes" | "no" | "unknown"
      stage_kind: "open" | "won" | "lost"
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
      activity_type: ["call", "email", "meeting", "note", "status_changed"],
      automation_action: [
        "set_reminder",
        "assign_member",
        "add_note",
        "suggest_advance",
        "webhook",
      ],
      automation_trigger: ["lead_enters_stage", "lead_idle_in_stage"],
      checklist_item: ["interest", "need", "budget", "authority", "timeline"],
      lead_source: ["website", "referral", "social_media", "phone", "other"],
      member_role: ["owner", "member"],
      qualification_answer: ["yes", "no", "unknown"],
      stage_kind: ["open", "won", "lost"],
    },
  },
} as const
