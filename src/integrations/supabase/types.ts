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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          current_approver_role: Database["public"]["Enums"]["app_role"]
          id: string
          notes: string | null
          record_id: string
          record_table: string
          rejection_reason: string | null
          requested_by: string
          status: string
          updated_at: string
          workflow_type: string
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          current_approver_role: Database["public"]["Enums"]["app_role"]
          id?: string
          notes?: string | null
          record_id: string
          record_table: string
          rejection_reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          workflow_type: string
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          current_approver_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          notes?: string | null
          record_id?: string
          record_table?: string
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          approval_order: number
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          required_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          workflow_type: string
        }
        Insert: {
          approval_order?: number
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          required_role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          workflow_type: string
        }
        Update: {
          approval_order?: number
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          required_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          accumulated_depreciation_account_id: string | null
          asset_account_id: string | null
          company_id: string | null
          created_at: string
          depreciation_account_id: string | null
          depreciation_method:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate: number | null
          description: string | null
          id: string
          name: string
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          company_id?: string | null
          created_at?: string
          depreciation_account_id?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          company_id?: string | null
          created_at?: string
          depreciation_account_id?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation: {
        Row: {
          accumulated_depreciation: number
          asset_id: string | null
          created_at: string
          depreciation_amount: number
          id: string
          is_posted: boolean | null
          journal_entry_id: string | null
          net_book_value: number
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
        }
        Insert: {
          accumulated_depreciation: number
          asset_id?: string | null
          created_at?: string
          depreciation_amount: number
          id?: string
          is_posted?: boolean | null
          journal_entry_id?: string | null
          net_book_value: number
          period_end: string
          period_start: string
          posted_at?: string | null
          posted_by?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string | null
          created_at?: string
          depreciation_amount?: number
          id?: string
          is_posted?: boolean | null
          journal_entry_id?: string | null
          net_book_value?: number
          period_end?: string
          period_start?: string
          posted_at?: string | null
          posted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciation_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string | null
          bank_name: string
          branch: string | null
          company_id: string | null
          created_at: string
          currency: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          opening_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string | null
          bank_name: string
          branch?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          opening_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string | null
          bank_name?: string
          branch?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          opening_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_deleted: boolean
          is_reconciled: boolean | null
          reconciled_date: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_reconciled?: boolean | null
          reconciled_date?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          is_reconciled?: boolean | null
          reconciled_date?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          approval_status: string | null
          base_currency_total: number | null
          bill_date: string
          bill_number: string
          company_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          exchange_rate: number | null
          id: string
          is_deleted: boolean
          is_locked: boolean
          paid_date: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          vat_amount: number | null
          vendor_id: string | null
        }
        Insert: {
          approval_status?: string | null
          base_currency_total?: number | null
          bill_date?: string
          bill_number: string
          company_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          paid_date?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Update: {
          approval_status?: string | null
          base_currency_total?: number | null
          bill_date?: string
          bill_number?: string
          company_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          paid_date?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_reconciliations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cash_paid: number
          cash_received: number
          closing_balance: number
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          opening_balance: number
          physical_count: number
          prepared_by: string
          reconciliation_date: string
          status: string
          updated_at: string
          variance: number
          variance_reason: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cash_paid?: number
          cash_received?: number
          closing_balance?: number
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          physical_count?: number
          prepared_by: string
          reconciliation_date: string
          status?: string
          updated_at?: string
          variance?: number
          variance_reason?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cash_paid?: number
          cash_received?: number
          closing_balance?: number
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          physical_count?: number
          prepared_by?: string
          reconciliation_date?: string
          status?: string
          updated_at?: string
          variance?: number
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          parent_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          base_currency: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          created_at: string
          email: string | null
          fiscal_year_start: number | null
          id: string
          industry_type: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          registration_number: string | null
          settings: Json | null
          slug: string | null
          tax_type: Database["public"]["Enums"]["tax_type"] | null
          tpin: string | null
          turnover_tax_number: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          base_currency?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry_type?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          registration_number?: string | null
          settings?: Json | null
          slug?: string | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          tpin?: string | null
          turnover_tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          base_currency?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry_type?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          registration_number?: string | null
          settings?: Json | null
          slug?: string | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          tpin?: string | null
          turnover_tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_name: string
          created_at: string
          id: string
          is_vat_registered: boolean | null
          logo_url: string | null
          updated_at: string
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          company_name?: string
          created_at?: string
          id?: string
          is_vat_registered?: boolean | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          is_vat_registered?: boolean | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      contractors: {
        Row: {
          bank_account_number: string | null
          bank_name: string | null
          company_id: string | null
          created_at: string
          daily_rate: number | null
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          specialty: string | null
          tpin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          specialty?: string | null
          tpin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_number?: string | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          specialty?: string | null
          tpin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number | null
          id: string
          is_active: boolean | null
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          grant_reference: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          project_id: string | null
          tpin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          grant_reference?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          project_id?: string | null
          tpin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          grant_reference?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string | null
          tpin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_records: {
        Row: {
          can_restore: boolean
          company_id: string | null
          deleted_at: string
          deleted_by: string
          deletion_reason: string | null
          id: string
          original_id: string
          original_table: string
          record_data: Json
        }
        Insert: {
          can_restore?: boolean
          company_id?: string | null
          deleted_at?: string
          deleted_by: string
          deletion_reason?: string | null
          id?: string
          original_id: string
          original_table: string
          record_data: Json
        }
        Update: {
          can_restore?: boolean
          company_id?: string | null
          deleted_at?: string
          deleted_by?: string
          deletion_reason?: string | null
          id?: string
          original_id?: string
          original_table?: string
          record_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "deleted_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string | null
          to_currency: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          source?: string | null
          to_currency: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string | null
          category: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          id: string
          is_deleted: boolean
          is_locked: boolean
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          updated_at: string
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          approval_status?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          expense_date?: string
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          created_at: string
          end_date: string
          financial_year_id: string | null
          id: string
          is_adjusting_period: boolean | null
          period_name: string
          period_number: number
          start_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date: string
          financial_year_id?: string | null
          id?: string
          is_adjusting_period?: boolean | null
          period_name: string
          period_number: number
          start_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date?: string
          financial_year_id?: string | null
          id?: string
          is_adjusting_period?: boolean | null
          period_name?: string
          period_number?: number
          start_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          created_at: string
          end_date: string
          id: string
          is_adjusting_period: boolean | null
          start_date: string
          status: string | null
          updated_at: string
          year_name: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_adjusting_period?: boolean | null
          start_date: string
          status?: string | null
          updated_at?: string
          year_name: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_adjusting_period?: boolean | null
          start_date?: string
          status?: string | null
          updated_at?: string
          year_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number | null
          asset_number: string
          category_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          depreciation_method:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate: number | null
          description: string | null
          disposal_amount: number | null
          disposal_date: string | null
          disposal_method: string | null
          id: string
          invoice_reference: string | null
          is_deleted: boolean | null
          last_depreciation_date: string | null
          location: string | null
          name: string
          net_book_value: number | null
          notes: string | null
          purchase_cost: number
          purchase_date: string
          residual_value: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"] | null
          updated_at: string
          useful_life_months: number
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          accumulated_depreciation?: number | null
          asset_number: string
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate?: number | null
          description?: string | null
          disposal_amount?: number | null
          disposal_date?: string | null
          disposal_method?: string | null
          id?: string
          invoice_reference?: string | null
          is_deleted?: boolean | null
          last_depreciation_date?: string | null
          location?: string | null
          name: string
          net_book_value?: number | null
          notes?: string | null
          purchase_cost: number
          purchase_date: string
          residual_value?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string
          useful_life_months: number
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          accumulated_depreciation?: number | null
          asset_number?: string
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          depreciation_method?:
            | Database["public"]["Enums"]["depreciation_method"]
            | null
          depreciation_rate?: number | null
          description?: string | null
          disposal_amount?: number | null
          disposal_date?: string | null
          disposal_method?: string | null
          id?: string
          invoice_reference?: string | null
          is_deleted?: boolean | null
          last_depreciation_date?: string | null
          location?: string | null
          name?: string
          net_book_value?: number | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string
          residual_value?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string
          useful_life_months?: number
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          quantity_on_hand: number | null
          reorder_point: number | null
          selling_price: number | null
          sku: string | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          quantity_on_hand?: number | null
          reorder_point?: number | null
          selling_price?: number | null
          sku?: string | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          quantity_on_hand?: number | null
          reorder_point?: number | null
          selling_price?: number | null
          sku?: string | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approval_status: string | null
          base_currency_total: number | null
          company_id: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          exchange_rate: number | null
          grant_reference: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_deleted: boolean
          is_locked: boolean
          locked_at: string | null
          notes: string | null
          project_reference: string | null
          status: string | null
          subtotal: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          vat_amount: number | null
          zra_invoice_number: string | null
          zra_qr_code: string | null
          zra_submission_status: string | null
          zra_submitted_at: string | null
        }
        Insert: {
          approval_status?: string | null
          base_currency_total?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          grant_reference?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          is_deleted?: boolean
          is_locked?: boolean
          locked_at?: string | null
          notes?: string | null
          project_reference?: string | null
          status?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          zra_invoice_number?: string | null
          zra_qr_code?: string | null
          zra_submission_status?: string | null
          zra_submitted_at?: string | null
        }
        Update: {
          approval_status?: string | null
          base_currency_total?: number | null
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          grant_reference?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_deleted?: boolean
          is_locked?: boolean
          locked_at?: string | null
          notes?: string | null
          project_reference?: string | null
          status?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          zra_invoice_number?: string | null
          zra_qr_code?: string | null
          zra_submission_status?: string | null
          zra_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          approval_status: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          entry_date: string
          id: string
          is_deleted: boolean
          is_locked: boolean
          is_posted: boolean | null
          reference_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          is_posted?: boolean | null
          reference_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          is_posted?: boolean | null
          reference_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          related_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          related_table?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      payroll_journals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          journal_entry_id: string | null
          journal_type: string
          payroll_run_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_type: string
          payroll_run_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_type?: string
          payroll_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_journals_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_journals_payroll_run_id_fkey"
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
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          finalized_at: string | null
          finalized_by: string | null
          gl_journal_id: string | null
          gl_posted: boolean | null
          id: string
          is_deleted: boolean
          is_locked: boolean
          notes: string | null
          payroll_number: string | null
          payroll_status: Database["public"]["Enums"]["payroll_status"] | null
          period_end: string
          period_start: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          run_date: string
          status: string | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          trial_run_at: string | null
          trial_run_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gl_journal_id?: string | null
          gl_posted?: boolean | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          notes?: string | null
          payroll_number?: string | null
          payroll_status?: Database["public"]["Enums"]["payroll_status"] | null
          period_end: string
          period_start: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          run_date: string
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          trial_run_at?: string | null
          trial_run_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gl_journal_id?: string | null
          gl_posted?: boolean | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          notes?: string | null
          payroll_number?: string | null
          payroll_status?: Database["public"]["Enums"]["payroll_status"] | null
          period_end?: string
          period_start?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          run_date?: string
          status?: string | null
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          trial_run_at?: string | null
          trial_run_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_gl_journal_id_fkey"
            columns: ["gl_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      period_locks: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          lock_reason: string | null
          locked_at: string
          locked_by: string
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by: string
          period_end: string
          period_start: string
          period_type?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by?: string
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_locks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          organization_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          organization_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          project_id: string
          receipt_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          project_id: string
          receipt_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          project_id?: string
          receipt_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          code: string | null
          company_id: string | null
          created_at: string
          description: string | null
          donor_name: string | null
          end_date: string | null
          grant_reference: string | null
          id: string
          name: string
          spent: number | null
          start_date: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          donor_name?: string | null
          end_date?: string | null
          grant_reference?: string | null
          id?: string
          name: string
          spent?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          donor_name?: string | null
          end_date?: string | null
          grant_reference?: string | null
          id?: string
          name?: string
          spent?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          description: string | null
          expected_date: string | null
          id: string
          order_date: string
          order_number: string
          status: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          vat_amount: number | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          order_number: string
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          order_date?: string
          order_number?: string
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          bank_account_id: string
          book_balance: number
          created_at: string
          difference: number | null
          id: string
          notes: string | null
          reconciliation_date: string
          statement_balance: number
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_id: string
          book_balance: number
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciliation_date: string
          statement_balance: number
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string
          book_balance?: number
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciliation_date?: string
          statement_balance?: number
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          order_type: string
          status: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          order_type?: string
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          order_type?: string
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          inventory_item_id: string
          is_deleted: boolean
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          inventory_item_id: string
          is_deleted?: boolean
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          inventory_item_id?: string
          is_deleted?: boolean
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliation_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          physical_quantity: number
          reconciliation_id: string | null
          system_quantity: number
          unit_cost: number
          variance: number | null
          variance_reason: string | null
          variance_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          physical_quantity: number
          reconciliation_id?: string | null
          system_quantity: number
          unit_cost?: number
          variance?: number | null
          variance_reason?: string | null
          variance_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          physical_quantity?: number
          reconciliation_id?: string | null
          system_quantity?: number
          unit_cost?: number
          variance?: number | null
          variance_reason?: string | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliation_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "stock_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          prepared_by: string
          reconciliation_date: string
          status: string
          total_items_counted: number
          total_variances: number
          updated_at: string
          variance_value: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prepared_by: string
          reconciliation_date: string
          status?: string
          total_items_counted?: number
          total_variances?: number
          updated_at?: string
          variance_value?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prepared_by?: string
          reconciliation_date?: string
          status?: string
          total_items_counted?: number
          total_variances?: number
          updated_at?: string
          variance_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          company_id: string | null
          contractor_id: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          hourly_rate: number | null
          hours_worked: number
          id: string
          project_name: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          company_id?: string | null
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          hourly_rate?: number | null
          hours_worked: number
          id?: string
          project_name?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          company_id?: string | null
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          hourly_rate?: number | null
          hours_worked?: number
          id?: string
          project_name?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      vendors: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          tpin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tpin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          tpin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      zra_submissions: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          last_retry_at: string | null
          qr_code: string | null
          raw_request: Json | null
          raw_response: Json | null
          response_code: string | null
          response_message: string | null
          retry_count: number | null
          submission_date: string | null
          submission_status: string | null
          submission_type: string
          updated_at: string
          zra_invoice_number: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          last_retry_at?: string | null
          qr_code?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          response_code?: string | null
          response_message?: string | null
          retry_count?: number | null
          submission_date?: string | null
          submission_status?: string | null
          submission_type?: string
          updated_at?: string
          zra_invoice_number?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          last_retry_at?: string | null
          qr_code?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          response_code?: string | null
          response_message?: string | null
          retry_count?: number | null
          submission_date?: string | null
          submission_status?: string | null
          submission_type?: string
          updated_at?: string
          zra_invoice_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zra_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zra_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_monthly_depreciation: {
        Args: {
          p_current_nbv?: number
          p_depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          p_depreciation_rate?: number
          p_purchase_cost: number
          p_residual_value: number
          p_useful_life_months: number
        }
        Returns: number
      }
      create_notification: {
        Args: {
          p_message: string
          p_related_id?: string
          p_related_table?: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      generate_payroll_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_period_locked: {
        Args: { check_company_id: string; check_date: string }
        Returns: boolean
      }
      log_audit:
        | {
            Args: {
              p_action: string
              p_new_values?: Json
              p_old_values?: Json
              p_record_id: string
              p_table_name: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action: string
              p_new_values?: Json
              p_old_values?: Json
              p_record_id: string
              p_table_name: string
            }
            Returns: undefined
          }
      soft_delete_record: {
        Args: {
          p_deletion_reason?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: boolean
      }
      user_in_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      validate_payroll_transition: {
        Args: {
          p_current_status: Database["public"]["Enums"]["payroll_status"]
          p_new_status: Database["public"]["Enums"]["payroll_status"]
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
        | "super_admin"
        | "accountant"
        | "bookkeeper"
        | "inventory_manager"
        | "staff"
        | "financial_manager"
        | "assistant_accountant"
        | "cashier"
      asset_status:
        | "active"
        | "disposed"
        | "fully_depreciated"
        | "under_maintenance"
      business_type:
        | "sme"
        | "ngo"
        | "school"
        | "corporate"
        | "government"
        | "other"
      depreciation_method:
        | "straight_line"
        | "reducing_balance"
        | "units_of_production"
      payroll_status: "draft" | "trial" | "final" | "reversed"
      tax_type: "vat_registered" | "turnover_tax" | "non_vat" | "tax_exempt"
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
        "super_admin",
        "accountant",
        "bookkeeper",
        "inventory_manager",
        "staff",
        "financial_manager",
        "assistant_accountant",
        "cashier",
      ],
      asset_status: [
        "active",
        "disposed",
        "fully_depreciated",
        "under_maintenance",
      ],
      business_type: [
        "sme",
        "ngo",
        "school",
        "corporate",
        "government",
        "other",
      ],
      depreciation_method: [
        "straight_line",
        "reducing_balance",
        "units_of_production",
      ],
      payroll_status: ["draft", "trial", "final", "reversed"],
      tax_type: ["vat_registered", "turnover_tax", "non_vat", "tax_exempt"],
    },
  },
} as const
