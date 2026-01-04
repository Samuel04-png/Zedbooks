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
      audit_logs: {
        Row: {
          action: string
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
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string | null
          bank_name: string
          branch: string | null
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
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          opening_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          description: string | null
          id: string
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
          description?: string | null
          id?: string
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
          description?: string | null
          id?: string
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
          bill_date: string
          bill_number: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
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
          bill_date?: string
          bill_number: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
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
          bill_date?: string
          bill_number?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
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
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
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
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
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
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          updated_at: string
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
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
        Relationships: []
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
          created_at: string
          customer_id: string | null
          due_date: string | null
          grant_reference: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          project_reference: string | null
          status: string | null
          subtotal: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          grant_reference?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          project_reference?: string | null
          status?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          grant_reference?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          project_reference?: string | null
          status?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: [
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
          created_at: string
          description: string | null
          entry_date: string
          id: string
          is_posted: boolean | null
          reference_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          is_posted?: boolean | null
          reference_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          is_posted?: boolean | null
          reference_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
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
          id: string
          inventory_item_id: string
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
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
      time_entries: {
        Row: {
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
      log_audit: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
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
      ],
    },
  },
} as const
