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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          message_id: string
          mime_type?: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          recipient_id: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          recipient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          recipient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          company: string | null
          contact_id: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          name: string | null
          opened_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string
          click_count: number
          created_at: string
          created_by: string
          failed_count: number
          from_email: string | null
          id: string
          name: string
          open_count: number
          scheduled_at: string | null
          sent_count: number
          status: string
          subject: string
          team_id: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          body_html?: string
          click_count?: number
          created_at?: string
          created_by: string
          failed_count?: number
          from_email?: string | null
          id?: string
          name: string
          open_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          team_id: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          body_html?: string
          click_count?: number
          created_at?: string
          created_by?: string
          failed_count?: number
          from_email?: string | null
          id?: string
          name?: string
          open_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          team_id?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_conversations: {
        Row: {
          contact_id: string
          conversation_id: string
        }
        Insert: {
          contact_id: string
          conversation_id: string
        }
        Update: {
          contact_id?: string
          conversation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          custom_fields: Json | null
          email: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          salesperson: string | null
          street: string | null
          street2: string | null
          team_id: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          salesperson?: string | null
          street?: string | null
          street2?: string | null
          team_id: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          salesperson?: string | null
          street?: string | null
          street2?: string | null
          team_id?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          category: string | null
          contact_id: string | null
          created_at: string
          entities: Json | null
          from_email: string | null
          from_name: string | null
          gmail_thread_id: string | null
          id: string
          is_noise: boolean
          is_read: boolean
          last_message_at: string
          mailbox_id: string | null
          priority: string | null
          seq_number: number
          snippet: string | null
          snoozed_until: string | null
          state: Database["public"]["Enums"]["conversation_state"]
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string
          team_id: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          category?: string | null
          contact_id?: string | null
          created_at?: string
          entities?: Json | null
          from_email?: string | null
          from_name?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_noise?: boolean
          is_read?: boolean
          last_message_at?: string
          mailbox_id?: string | null
          priority?: string | null
          seq_number: number
          snippet?: string | null
          snoozed_until?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          category?: string | null
          contact_id?: string | null
          created_at?: string
          entities?: Json | null
          from_email?: string | null
          from_name?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_noise?: boolean
          is_read?: boolean
          last_message_at?: string
          mailbox_id?: string | null
          priority?: string | null
          seq_number?: number
          snippet?: string | null
          snoozed_until?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "team_mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          attachments: Json | null
          body: string | null
          conversation_id: string | null
          created_at: string
          created_by: string
          error_message: string | null
          from_email: string | null
          id: string
          status: string
          subject: string | null
          team_id: string
          to_email: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          status?: string
          subject?: string | null
          team_id: string
          to_email?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          status?: string
          subject?: string | null
          team_id?: string
          to_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          created_by: string
          id: string
          is_shared: boolean
          name: string
          subject: string
          team_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          body?: string
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_shared?: boolean
          name: string
          subject?: string
          team_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_shared?: boolean
          name?: string
          subject?: string
          team_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_signatures: {
        Row: {
          mailbox_id: string
          signature_id: string
        }
        Insert: {
          mailbox_id: string
          signature_id: string
        }
        Update: {
          mailbox_id?: string
          signature_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_signatures_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "team_mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_signatures_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc: string | null
          conversation_id: string
          created_at: string
          from_email: string | null
          from_name: string | null
          gmail_message_id: string | null
          id: string
          is_outbound: boolean
          sent_at: string
          to_email: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          conversation_id: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string | null
          id?: string
          is_outbound?: boolean
          sent_at?: string
          to_email?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          conversation_id?: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string | null
          id?: string
          is_outbound?: boolean
          sent_at?: string
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          comment_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          triggered_by: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          triggered_by?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          triggered_by?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_commands: {
        Row: {
          command_type: string
          conversation_id: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          payload: Json
          processed_at: string | null
          retry_count: number
          status: string
          team_id: string
        }
        Insert: {
          command_type: string
          conversation_id?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          team_id: string
        }
        Update: {
          command_type?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_commands_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_commands_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          created_by: string
          error_message: string | null
          from_email: string
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          team_id: string
          to_email: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          created_by: string
          error_message?: string | null
          from_email: string
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject: string
          team_id: string
          to_email: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          from_email?: string
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          team_id?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          body_html: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_journal: {
        Row: {
          action_taken: string
          conversation_id: string | null
          created_at: string
          drift_type: string
          id: string
          local_state: string | null
          mailbox_id: string | null
          remote_state: string | null
        }
        Insert: {
          action_taken: string
          conversation_id?: string | null
          created_at?: string
          drift_type: string
          id?: string
          local_state?: string | null
          mailbox_id?: string | null
          remote_state?: string | null
        }
        Update: {
          action_taken?: string
          conversation_id?: string | null
          created_at?: string
          drift_type?: string
          id?: string
          local_state?: string | null
          mailbox_id?: string | null
          remote_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_journal_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_journal_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "team_mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          conversation_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted: boolean
          created_at: string
          email: string
          id: string
          invited_by: string
          team_id: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by: string
          team_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_mailboxes: {
        Row: {
          created_at: string
          email: string
          full_scan_page_token: string | null
          history_id: number | null
          id: string
          label: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_run_at: string | null
          last_successful_sync_at: string | null
          last_sync_at: string | null
          sync_enabled: boolean
          sync_mode: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_scan_page_token?: string | null
          history_id?: number | null
          id?: string
          label?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_run_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          sync_enabled?: boolean
          sync_mode?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_scan_page_token?: string | null
          history_id?: number | null
          id?: string
          label?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_run_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          sync_enabled?: boolean
          sync_mode?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_mailboxes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          is_read: boolean
          last_message: string | null
          last_message_at: string
          phone_number: string
          status: string
          team_id: string
          updated_at: string
          wasender_chat_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string
          phone_number: string
          status?: string
          team_id: string
          updated_at?: string
          wasender_chat_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          last_message?: string | null
          last_message_at?: string
          phone_number?: string
          status?: string
          team_id?: string
          updated_at?: string
          wasender_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          from_name: string | null
          from_phone: string | null
          id: string
          is_outbound: boolean
          media_type: string | null
          media_url: string | null
          sent_at: string
          status: string
          to_phone: string | null
          wasender_message_id: string | null
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          from_name?: string | null
          from_phone?: string | null
          id?: string
          is_outbound?: boolean
          media_type?: string | null
          media_url?: string | null
          sent_at?: string
          status?: string
          to_phone?: string | null
          wasender_message_id?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          from_name?: string | null
          from_phone?: string | null
          id?: string
          is_outbound?: boolean
          media_type?: string | null
          media_url?: string | null
          sent_at?: string
          status?: string
          to_phone?: string | null
          wasender_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contacts_with_stats: {
        Row: {
          avatar_url: string | null
          city: string | null
          company: string | null
          conversation_count: number | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          external_id: string | null
          id: string | null
          last_interaction: string | null
          last_synced_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          salesperson: string | null
          street: string | null
          street2: string | null
          team_id: string | null
          updated_at: string | null
          zip: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_whatsapp_groups: { Args: never; Returns: undefined }
      conversation_detail: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      get_actionable_count: { Args: { _mailbox_id?: string }; Returns: number }
      get_sent_conversation_ids: {
        Args: never
        Returns: {
          conversation_id: string
        }[]
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inbox_list: {
        Args: {
          p_limit?: number
          p_mailbox_id?: string
          p_offset?: number
          p_state?: string
          p_status?: string
        }
        Returns: {
          ai_summary: string
          assigned_to: string
          assignee_name: string
          category: string
          from_email: string
          from_name: string
          has_draft: boolean
          id: string
          is_noise: boolean
          is_read: boolean
          last_message_at: string
          needs_reply: boolean
          priority: string
          seq_number: number
          snippet: string
          state: string
          status: string
          subject: string
          tag_colors: string[]
          tag_ids: string[]
          tag_names: string[]
        }[]
      }
      search_inbox: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          conversation_id: string
          id: string
          label: string
          result_type: string
          subtitle: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "member"
      conversation_state: "inbox" | "archived" | "trash" | "spam"
      conversation_status: "open" | "snoozed" | "closed"
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
      app_role: ["admin", "member"],
      conversation_state: ["inbox", "archived", "trash", "spam"],
      conversation_status: ["open", "snoozed", "closed"],
    },
  },
} as const
