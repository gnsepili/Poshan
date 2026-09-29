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
          steps?: number
          user_id?: string
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
      goals: {
        Row: {
          created_at: string
          daily_calorie_target: number
          daily_carbs_g: number
          daily_fat_g: number
          daily_protein_g: number
          daily_steps_target: number
          id: string
          notes: string
          target_body_fat_pct: number | null
          target_muscle_mass_kg: number | null
          target_weight_kg: number
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_calorie_target: number
          daily_carbs_g: number
          daily_fat_g: number
          daily_protein_g: number
          daily_steps_target?: number
          id?: string
          notes?: string
          target_body_fat_pct?: number | null
          target_muscle_mass_kg?: number | null
          target_weight_kg: number
          user_id: string
        }
        Update: {
          created_at?: string
          daily_calorie_target?: number
          daily_carbs_g?: number
          daily_fat_g?: number
          daily_protein_g?: number
          daily_steps_target?: number
          id?: string
          notes?: string
          target_body_fat_pct?: number | null
          target_muscle_mass_kg?: number | null
          target_weight_kg?: number
          user_id?: string
        }
        Relationships: []
      }
      inbody_reports: {
        Row: {
          ai_notes: string | null
          bmr: number | null
          body_fat_pct: number | null
          created_at: string
          id: string
          muscle_mass_kg: number | null
          photo_url: string | null
          raw_extracted_json: Json | null
          scanned_at: string
          user_id: string
          visceral_fat: number | null
          weight_kg: number | null
        }
        Insert: {
          ai_notes?: string | null
          bmr?: number | null
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          muscle_mass_kg?: number | null
          photo_url?: string | null
          raw_extracted_json?: Json | null
          scanned_at?: string
          user_id: string
          visceral_fat?: number | null
          weight_kg?: number | null
        }
        Update: {
          ai_notes?: string | null
          bmr?: number | null
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          muscle_mass_kg?: number | null
          photo_url?: string | null
          raw_extracted_json?: Json | null
          scanned_at?: string
          user_id?: string
          visceral_fat?: number | null
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
          logged_at: string
          meal_type: string
          photo_url: string | null
          protein_g: number
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
          logged_at?: string
          meal_type: string
          photo_url?: string | null
          protein_g?: number
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
          logged_at?: string
          meal_type?: string
          photo_url?: string | null
          protein_g?: number
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
      [_ in never]: never
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
