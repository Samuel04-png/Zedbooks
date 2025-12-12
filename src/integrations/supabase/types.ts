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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      advances: {
        Row: {
          amount: number
          created_at: string
          date_given: string
          date_to_deduct: string | null
          employee_id: string
          id: string
          monthly_deduction: number | null
          months_deducted: number | null
          months_to_repay: number | null
          reason: string | null
          remaining_balance: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          date_given: string
          date_to_deduct?: string | null
          employee_id: string
          id?: string
          monthly_deduction?: number | null
          months_deducted?: number | null
          months_to_repay?: number | null
          reason?: string | null
          remaining_balance?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_given?: string
          date_to_deduct?: string | null
          employee_id?: string
          id?: string
          monthly_deduction?: number | null
          months_deducted?: number | null
          months_to_repay?: number | null
          reason?: string | null
          remaining_balance?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_name: string
          created_at: string
          id: string
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number
          contract_end_date: string | null
          contract_start_date: string | null
          contract_type: string | null
          created_at: string
          department: string | null
          email: string | null
          employee_number: string
          employment_date: string
          employment_status: string | null
          full_name: string
          gratuity_rate: number | null
          has_gratuity: boolean | null
          housing_allowance: number | null
          id: string
          napsa_number: string | null
          nhima_number: string | null
          other_allowances: number | null
          phone: string | null
          position: string | null
          tpin: string | null
          transport_allowance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary: number
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_number: string
          employment_date: string
          employment_status?: string | null
          full_name: string
          gratuity_rate?: number | null
          has_gratuity?: boolean | null
          housing_allowance?: number | null
          id?: string
          napsa_number?: string | null
          nhima_number?: string | null
          other_allowances?: number | null
          phone?: string | null
          position?: string | null
          tpin?: string | null
          transport_allowance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employee_number?: string
          employment_date?: string
          employment_status?: string | null
          full_name?: string
          gratuity_rate?: number | null
          has_gratuity?: boolean | null
          housing_allowance?: number | null
          id?: string
          napsa_number?: string | null
          nhima_number?: string | null
          other_allowances?: number | null
          phone?: string | null
          position?: string | null
          tpin?: string | null
          transport_allowance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_additions: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          monthly_deduction: number | null
          months_to_pay: number | null
          name: string
          payroll_run_id: string
          remaining_balance: number | null
          total_amount: number | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          monthly_deduction?: number | null
          months_to_pay?: number | null
          name: string
          payroll_run_id: string
          remaining_balance?: number | null
          total_amount?: number | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          monthly_deduction?: number | null
          months_to_pay?: number | null
          name?: string
          payroll_run_id?: string
          remaining_balance?: number | null
          total_amount?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_additions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_additions_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          advances_deducted: number | null
          basic_salary: number
          created_at: string
          employee_id: string
          gross_salary: number
          housing_allowance: number | null
          id: string
          napsa_employee: number | null
          napsa_employer: number | null
          net_salary: number
          nhima_employee: number | null
          nhima_employer: number | null
          other_allowances: number | null
          other_deductions: number | null
          paye: number | null
          payroll_run_id: string
          total_deductions: number
          transport_allowance: number | null
        }
        Insert: {
          advances_deducted?: number | null
          basic_salary: number
          created_at?: string
          employee_id: string
          gross_salary: number
          housing_allowance?: number | null
          id?: string
          napsa_employee?: number | null
          napsa_employer?: number | null
          net_salary: number
          nhima_employee?: number | null
          nhima_employer?: number | null
          other_allowances?: number | null
          other_deductions?: number | null
          paye?: number | null
          payroll_run_id: string
          total_deductions: number
          transport_allowance?: number | null
        }
        Update: {
          advances_deducted?: number | null
          basic_salary?: number
          created_at?: string
          employee_id?: string
          gross_salary?: number
          housing_allowance?: number | null
          id?: string
          napsa_employee?: number | null
          napsa_employer?: number | null
          net_salary?: number
          nhima_employee?: number | null
          nhima_employer?: number | null
          other_allowances?: number | null
          other_deductions?: number | null
          paye?: number | null
          payroll_run_id?: string
          total_deductions?: number
          transport_allowance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          run_date: string
          status: string | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          run_date: string
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          run_date?: string
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          organization_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          organization_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          organization_name?: string
          phone?: string | null
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "finance_officer"
        | "hr_manager"
        | "project_manager"
        | "auditor"
        | "read_only"
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
      app_role: [
        "admin",
        "finance_officer",
        "hr_manager",
        "project_manager",
        "auditor",
        "read_only",
      ],
    },
  },
} as const
