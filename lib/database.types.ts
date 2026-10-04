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
      activity_logs: {
        Row: {
          activity_type: string
          calories_burned: number
          created_at: string
          duration_min: number
          id: string
          logged_at: string
          notes: string
          source: string
          steps: number
          user_id: string
        }
        Insert: {
          activity_type: string
          calories_burned?: number
          created_at?: string
          duration_min?: number
          id?: string
          logged_at?: string
          notes?: string
          source?: string
          steps?: number
          user_id: string
        }
        Update: {
          activity_type?: string
          calories_burned?: number
          created_at?: string
          duration_min?: number
          id?: string
          logged_at?: string
          notes?: string
          source?: string
          steps?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          date: string
          user_id: string
        }
        Insert: {
          count?: number
          date?: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          context_snapshot: Json | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          ai_coach_note: string | null
          ai_daily_goals: Json | null
          created_at: string
          date: string
          id: string
          total_calories_consumed: number
          total_carbs_g: number
          total_fat_g: number
          total_protein_g: number
          total_steps: number
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          ai_coach_note?: string | null
          ai_daily_goals?: Json | null
          created_at?: string
          date: string
          id?: string
          total_calories_consumed?: number
          total_carbs_g?: number
          total_fat_g?: number
          total_protein_g?: number
          total_steps?: number
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          ai_coach_note?: string | null
          ai_daily_goals?: Json | null
          created_at?: string
          date?: string
          id?: string
          total_calories_consumed?: number
          total_carbs_g?: number
          total_fat_g?: number
          total_protein_g?: number
          total_steps?: number
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: string
          created_at: string
          id: string
          message: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context: string
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          daily_calorie_target: number
          daily_carbs_g: number
          daily_fat_g: number
          daily_protein_g: number
          daily_steps_target: number
          goal_type: string | null
          id: string
          notes: string
          target_body_fat_pct: number | null
          target_muscle_mass_kg: number | null
          target_weight_kg: number
          user_id: string
          weekly_rate_kg: number | null
        }
        Insert: {
          created_at?: string
          daily_calorie_target: number
          daily_carbs_g: number
          daily_fat_g: number
          daily_protein_g: number
          daily_steps_target?: number
          goal_type?: string | null
          id?: string
          notes?: string
          target_body_fat_pct?: number | null
          target_muscle_mass_kg?: number | null
          target_weight_kg: number
          user_id: string
          weekly_rate_kg?: number | null
        }
        Update: {
          created_at?: string
          daily_calorie_target?: number
          daily_carbs_g?: number
          daily_fat_g?: number
          daily_protein_g?: number
          daily_steps_target?: number
          goal_type?: string | null
          id?: string
          notes?: string
          target_body_fat_pct?: number | null
          target_muscle_mass_kg?: number | null
          target_weight_kg?: number
          user_id?: string
          weekly_rate_kg?: number | null
        }
        Relationships: []
      }
      inbody_reports: {
        Row: {
          ai_notes: string | null
          bmi: number | null
          bmr: number | null
          body_fat_mass_kg: number | null
          body_fat_pct: number | null
          created_at: string
          ecw_tbw_ratio: number | null
          extraction_version: number
          fat_free_mass_kg: number | null
          id: string
          inbody_score: number | null
          muscle_mass_kg: number | null
          phase_angle: number | null
          photo_url: string | null
          raw_extracted_json: Json | null
          scanned_at: string
          smi: number | null
          target_weight_kg: number | null
          total_body_water_l: number | null
          user_id: string
          visceral_fat: number | null
          waist_hip_ratio: number | null
          weight_kg: number | null
        }
        Insert: {
          ai_notes?: string | null
          bmi?: number | null
          bmr?: number | null
          body_fat_mass_kg?: number | null
          body_fat_pct?: number | null
          created_at?: string
          ecw_tbw_ratio?: number | null
          extraction_version?: number
          fat_free_mass_kg?: number | null
          id?: string
          inbody_score?: number | null
          muscle_mass_kg?: number | null
          phase_angle?: number | null
          photo_url?: string | null
          raw_extracted_json?: Json | null
          scanned_at?: string
          smi?: number | null
          target_weight_kg?: number | null
          total_body_water_l?: number | null
          user_id: string
          visceral_fat?: number | null
          waist_hip_ratio?: number | null
          weight_kg?: number | null
        }
        Update: {
          ai_notes?: string | null
          bmi?: number | null
          bmr?: number | null
          body_fat_mass_kg?: number | null
          body_fat_pct?: number | null
          created_at?: string
          ecw_tbw_ratio?: number | null
          extraction_version?: number
          fat_free_mass_kg?: number | null
          id?: string
          inbody_score?: number | null
          muscle_mass_kg?: number | null
          phase_angle?: number | null
          photo_url?: string | null
          raw_extracted_json?: Json | null
          scanned_at?: string
          smi?: number | null
          target_weight_kg?: number | null
          total_body_water_l?: number | null
          user_id?: string
          visceral_fat?: number | null
          waist_hip_ratio?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          plan_json: Json
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_json: Json
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_json?: Json
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          ai_suggestions: string | null
          carbs_g: number
          created_at: string
          description: string
          fat_g: number
          fiber_g: number
          id: string
          items: Json | null
          logged_at: string
          meal_type: string
          photo_url: string | null
          protein_g: number
          score: number | null
          score_label: string | null
          total_calories: number
          user_id: string
        }
        Insert: {
          ai_suggestions?: string | null
          carbs_g?: number
          created_at?: string
          description?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          items?: Json | null
          logged_at?: string
          meal_type: string
          photo_url?: string | null
          protein_g?: number
          score?: number | null
          score_label?: string | null
          total_calories?: number
          user_id: string
        }
        Update: {
          ai_suggestions?: string | null
          carbs_g?: number
          created_at?: string
          description?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          items?: Json | null
          logged_at?: string
          meal_type?: string
          photo_url?: string | null
          protein_g?: number
          score?: number | null
          score_label?: string | null
          total_calories?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string
          age: number
          ai_provider: string
          created_at: string
          current_weight_kg: number
          health_conditions: string
          height_cm: number
          id: string
          lifestyle_notes: string
          sex: string
          treatment_duration_months: number
          updated_at: string
        }
        Insert: {
          activity_level: string
          age: number
          ai_provider?: string
          created_at?: string
          current_weight_kg: number
          health_conditions?: string
          height_cm: number
          id: string
          lifestyle_notes?: string
          sex: string
          treatment_duration_months?: number
          updated_at?: string
        }
        Update: {
          activity_level?: string
          age?: number
          ai_provider?: string
          created_at?: string
          current_weight_kg?: number
          health_conditions?: string
          height_cm?: number
          id?: string
          lifestyle_notes?: string
          sex?: string
          treatment_duration_months?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_plans: {
        Row: {
          created_at: string
          id: string
          plan_json: Json
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_json: Json
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_json?: Json
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_ai_usage: {
        Args: { p_cap: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
