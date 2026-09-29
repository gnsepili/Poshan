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
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
