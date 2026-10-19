// Database types in the same shape `supabase gen types typescript` produces.
// If you change supabase/schema.sql you can regenerate this file with:
//   npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      entourage_links: {
        Row: { member_id: string; invitation_id: string; guest_id: string | null; created_at: string }
        Insert: { member_id: string; invitation_id: string; guest_id?: string | null; created_at?: string }
        Update: { member_id?: string; invitation_id?: string; guest_id?: string | null; created_at?: string }
        Relationships: []
      }
      seating_tables: {
        Row: {
          id: string
          name: string
          shape: string
          capacity: number
          seat_sides: string
          x: number
          y: number
          width: number
          height: number
          rotation: number
          placed: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          shape?: string
          capacity?: number
          seat_sides?: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          placed?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          shape?: string
          capacity?: number
          seat_sides?: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          placed?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      seating_items: {
        Row: {
          id: string
          kind: string
          label: string
          x: number
          y: number
          width: number
          height: number
          rotation: number
          location: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          label?: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          location?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: string
          label?: string
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          location?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      seat_assignments: {
        Row: {
          id: string
          table_id: string
          seat_index: number
          invitation_id: string
          guest_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_id: string
          seat_index: number
          invitation_id: string
          guest_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_id?: string
          seat_index?: number
          invitation_id?: string
          guest_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      seating_notices: {
        Row: {
          id: string
          person_name: string
          table_name: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          person_name: string
          table_name: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          person_name?: string
          table_name?: string
          reason?: string
          created_at?: string
        }
        Relationships: []
      }
      wedding_settings: {
        Row: {
          id: string
          singleton: boolean
          couple_names: string
          baby_name: string
          due_date: string | null
          due_text: string | null
          due_visible: boolean
          wedding_date: string
          hero_title: string | null
          hero_subtitle: string | null
          hero_image_url: string | null
          church_name: string | null
          ceremony_time: string | null
          reception_time: string | null
          church_map_url: string | null
          reception_name: string | null
          reception_map_url: string | null
          story_text: string | null
          closing_message: string | null
          outfit_title: string | null
          outfit_subtitle: string | null
          outfit_section_visible: boolean
          outfit_layout: string
          rsvp_deadline: string | null
          rsvp_open: boolean
          rsvp_closed_message: string | null
          rsvp_button_label: string
          rsvp_show_deadline: boolean
          entourage: Json
          entourage_visible: boolean
          entourage_title: string | null
          entourage_subtitle: string | null
          motif_title: string | null
          motif_colors: Json
          gallery_visible: boolean
          gallery_title: string | null
          gallery_subtitle: string | null
          gallery_layout: string
          video_visible: boolean
          video_title: string | null
          video_caption: string | null
          video_url: string | null
          media_order: Json
          program_visible: boolean
          program_title: string | null
          program_subtitle: string | null
          verse_visible: boolean
          verse_text: string | null
          verse_reference: string | null
          video_poster_url: string | null
          theme: Json
          rsvp_config: Json
          seating_config: Json
          additional_info: Json
          updated_at: string
        }
        Insert: {
          id?: string
          singleton?: boolean
          couple_names?: string
          baby_name?: string
          due_date?: string | null
          due_text?: string | null
          due_visible?: boolean
          wedding_date?: string
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          church_name?: string | null
          ceremony_time?: string | null
          reception_time?: string | null
          church_map_url?: string | null
          reception_name?: string | null
          reception_map_url?: string | null
          story_text?: string | null
          closing_message?: string | null
          outfit_title?: string | null
          outfit_subtitle?: string | null
          outfit_section_visible?: boolean
          outfit_layout?: string
          rsvp_deadline?: string | null
          rsvp_open?: boolean
          rsvp_closed_message?: string | null
          rsvp_button_label?: string
          rsvp_show_deadline?: boolean
          entourage?: Json
          entourage_visible?: boolean
          entourage_title?: string | null
          entourage_subtitle?: string | null
          motif_title?: string | null
          motif_colors?: Json
          gallery_visible?: boolean
          gallery_title?: string | null
          gallery_subtitle?: string | null
          gallery_layout?: string
          video_visible?: boolean
          video_title?: string | null
          video_caption?: string | null
          video_url?: string | null
          media_order?: Json
          program_visible?: boolean
          program_title?: string | null
          program_subtitle?: string | null
          verse_visible?: boolean
          verse_text?: string | null
          verse_reference?: string | null
          video_poster_url?: string | null
          theme?: Json
          rsvp_config?: Json
          seating_config?: Json
          additional_info?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          singleton?: boolean
          couple_names?: string
          baby_name?: string
          due_date?: string | null
          due_text?: string | null
          due_visible?: boolean
          wedding_date?: string
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          church_name?: string | null
          ceremony_time?: string | null
          reception_time?: string | null
          church_map_url?: string | null
          reception_name?: string | null
          reception_map_url?: string | null
          story_text?: string | null
          closing_message?: string | null
          outfit_title?: string | null
          outfit_subtitle?: string | null
          outfit_section_visible?: boolean
          outfit_layout?: string
          rsvp_deadline?: string | null
          rsvp_open?: boolean
          rsvp_closed_message?: string | null
          rsvp_button_label?: string
          rsvp_show_deadline?: boolean
          entourage?: Json
          entourage_visible?: boolean
          entourage_title?: string | null
          entourage_subtitle?: string | null
          motif_title?: string | null
          motif_colors?: Json
          gallery_visible?: boolean
          gallery_title?: string | null
          gallery_subtitle?: string | null
          gallery_layout?: string
          video_visible?: boolean
          video_title?: string | null
          video_caption?: string | null
          video_url?: string | null
          media_order?: Json
          program_visible?: boolean
          program_title?: string | null
          program_subtitle?: string | null
          verse_visible?: boolean
          verse_text?: string | null
          verse_reference?: string | null
          video_poster_url?: string | null
          theme?: Json
          rsvp_config?: Json
          seating_config?: Json
          additional_info?: Json
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          invitee_name: string
          search_name: string
          invitation_code: string
          printed_at: string | null
          position_mode: string
          side: string
          position_label: string | null
          addressed_as: string | null
          table_number: string | null
          table_id: string | null
          max_additional_guests: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invitee_name: string
          invitation_code?: string
          printed_at?: string | null
          position_mode?: string
          side?: string
          position_label?: string | null
          addressed_as?: string | null
          table_number?: string | null
          table_id?: string | null
          max_additional_guests?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invitee_name?: string
          invitation_code?: string
          printed_at?: string | null
          position_mode?: string
          side?: string
          position_label?: string | null
          addressed_as?: string | null
          table_number?: string | null
          table_id?: string | null
          max_additional_guests?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rsvp_responses: {
        Row: {
          id: string
          invitation_id: string
          attendance_status: string
          has_transportation: boolean | null
          needs_transportation: string | null
          vehicle_type: string | null
          coming_from: string | null
          food_preferences: string[]
          has_food_restrictions: boolean | null
          food_restrictions: string | null
          accessibility_needs: string | null
          bringing_additional_guest: boolean
          message_to_couple: string | null
          mobile_number: string | null
          recorded_by_admin: boolean
          custom_answers: Json
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invitation_id: string
          attendance_status: string
          has_transportation?: boolean | null
          needs_transportation?: string | null
          vehicle_type?: string | null
          coming_from?: string | null
          food_preferences?: string[]
          has_food_restrictions?: boolean | null
          food_restrictions?: string | null
          accessibility_needs?: string | null
          bringing_additional_guest?: boolean
          message_to_couple?: string | null
          mobile_number?: string | null
          recorded_by_admin?: boolean
          custom_answers?: Json
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invitation_id?: string
          attendance_status?: string
          has_transportation?: boolean | null
          needs_transportation?: string | null
          vehicle_type?: string | null
          coming_from?: string | null
          food_preferences?: string[]
          has_food_restrictions?: boolean | null
          food_restrictions?: string | null
          accessibility_needs?: string | null
          bringing_additional_guest?: boolean
          message_to_couple?: string | null
          mobile_number?: string | null
          recorded_by_admin?: boolean
          custom_answers?: Json
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rsvp_responses_invitation_id_fkey'
            columns: ['invitation_id']
            isOneToOne: true
            referencedRelation: 'invitations'
            referencedColumns: ['id']
          },
        ]
      }
      additional_guests: {
        Row: {
          id: string
          invitation_id: string
          rsvp_response_id: string | null
          guest_name: string
          status: string
          added_by: string
          merged_from: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invitation_id: string
          rsvp_response_id?: string | null
          guest_name: string
          status?: string
          added_by?: string
          merged_from?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invitation_id?: string
          rsvp_response_id?: string | null
          guest_name?: string
          status?: string
          added_by?: string
          merged_from?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'additional_guests_invitation_id_fkey'
            columns: ['invitation_id']
            isOneToOne: false
            referencedRelation: 'invitations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'additional_guests_rsvp_response_id_fkey'
            columns: ['rsvp_response_id']
            isOneToOne: false
            referencedRelation: 'rsvp_responses'
            referencedColumns: ['id']
          },
        ]
      }
      rsvp_questions: {
        Row: {
          id: string
          question: string
          help_text: string | null
          type: string
          options: Json
          max_selections: number | null
          min_value: number | null
          max_value: number | null
          max_length: number | null
          required: boolean
          audience: string
          show_if: Json | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question: string
          help_text?: string | null
          type: string
          options?: Json
          max_selections?: number | null
          min_value?: number | null
          max_value?: number | null
          max_length?: number | null
          required?: boolean
          audience?: string
          show_if?: Json | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question?: string
          help_text?: string | null
          type?: string
          options?: Json
          max_selections?: number | null
          min_value?: number | null
          max_value?: number | null
          max_length?: number | null
          required?: boolean
          audience?: string
          show_if?: Json | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          id: string
          image_url: string
          thumb_url: string | null
          caption: string | null
          sort_order: number
          is_visible: boolean
          section_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_url: string
          thumb_url?: string | null
          section_id?: string | null
          caption?: string | null
          sort_order?: number
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          thumb_url?: string | null
          caption?: string | null
          sort_order?: number
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_items: {
        Row: {
          id: string
          time_label: string
          title: string
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          time_label?: string
          title: string
          description?: string | null
          sort_order?: number
        }
        Update: {
          time_label?: string
          title?: string
          description?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      media_sections: {
        Row: {
          id: string
          kind: string
          title: string
          subtitle: string | null
          layout: string
          video_url: string | null
          poster_url: string | null
          is_visible: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          title?: string
          subtitle?: string | null
          layout?: string
          video_url?: string | null
          poster_url?: string | null
          is_visible?: boolean
          sort_order?: number
        }
        Update: {
          kind?: string
          title?: string
          subtitle?: string | null
          layout?: string
          video_url?: string | null
          poster_url?: string | null
          is_visible?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      guest_photos: {
        Row: {
          id: string
          invitation_id: string | null
          guest_id: string | null
          uploader_name: string
          path: string
          thumb_path: string
          bytes: number | null
          uploaded: boolean
          slot_expires_at: string
          status: string
          removed_by_guest: boolean
          created_at: string
        }
        Insert: {
          id?: string
          invitation_id?: string | null
          guest_id?: string | null
          uploader_name: string
          path: string
          thumb_path: string
          bytes?: number | null
          uploaded?: boolean
          slot_expires_at: string
          status?: string
          removed_by_guest?: boolean
          created_at?: string
        }
        Update: {
          status?: string
        }
        Relationships: []
      }
      raffle_draws: {
        Row: {
          id: string
          name: string
          prize: string | null
          place: number | null
          drawn_at: string
        }
        Insert: {
          id?: string
          name: string
          prize?: string | null
          place?: number | null
          drawn_at?: string
        }
        Update: {
          id?: string
          name?: string
          prize?: string | null
          place?: number | null
          drawn_at?: string
        }
        Relationships: []
      }
      invitation_opens: {
        Row: {
          invitation_id: string
          first_opened_at: string
          last_opened_at: string
          open_count: number
        }
        Insert: {
          invitation_id: string
          first_opened_at?: string
          last_opened_at?: string
          open_count?: number
        }
        Update: {
          invitation_id?: string
          first_opened_at?: string
          last_opened_at?: string
          open_count?: number
        }
        Relationships: []
      }
      admin_preferences: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value?: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      gift_settings: {
        Row: {
          singleton: boolean
          is_visible: boolean
          placement: string
          title: string | null
          message: string | null
          qr_image_url: string | null
          updated_at: string
        }
        Insert: {
          singleton?: boolean
          is_visible?: boolean
          placement?: string
          title?: string | null
          message?: string | null
          qr_image_url?: string | null
          updated_at?: string
        }
        Update: {
          singleton?: boolean
          is_visible?: boolean
          placement?: string
          title?: string | null
          message?: string | null
          qr_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outfit_images: {
        Row: {
          id: string
          gender: string
          image_url: string
          caption: string | null
          label: string | null
          sort_order: number
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gender: string
          image_url: string
          caption?: string | null
          label?: string | null
          sort_order?: number
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gender?: string
          image_url?: string
          caption?: string | null
          label?: string | null
          sort_order?: number
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          id: string
          admin_user_id: string | null
          action: string
          target_table: string | null
          target_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id?: string | null
          action: string
          target_table?: string | null
          target_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string | null
          action?: string
          target_table?: string | null
          target_id?: string | null
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          user_id: string
          email: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          email?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          email?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_invitation: {
        Args: { search_name: string }
        Returns: {
          invitation_id: string
          invitee_name: string
          table_number: string | null
          max_additional_guests: number
          has_existing_response: boolean
          included_guests: string[]
        }[]
      }
      find_included_guest: {
        Args: { search_name: string }
        Returns: {
          invitee_name: string
          attendance_status: string | null
        }[]
      }
      remove_table_seat: {
        Args: { p_table_id: string; p_seat_index: number }
        Returns: number
      }
      public_display_prefs: {
        Args: Record<string, never>
        Returns: Json
      }
      invitation_card: {
        Args: { p_invitation_id: string }
        Returns: {
          position_mode: string
          position_label: string | null
          position_member_id: string | null
          attendance_status: string | null
          addressed_as: string | null
        }[]
      }
      raffle_pool: {
        Args: Record<string, never>
        Returns: { name: string; side: string; attending: boolean }[]
      }
      raffle_wheel: {
        Args: Record<string, never>
        Returns: Json
      }
      raffle_host_token: {
        Args: { p_action: string }
        Returns: string | null
      }
      raffle_host_link_on: {
        Args: Record<string, never>
        Returns: boolean
      }
      raffle_host_board: {
        Args: { p_token: string }
        Returns: Json
      }
      raffle_host_state: {
        Args: { p_token: string }
        Returns: Json
      }
      raffle_host_land: {
        Args: { p_token: string; p_key: string; p_prize: string }
        Returns: Json
      }
      raffle_host_code_login: {
        Args: { p_pin: string }
        Returns: Json
      }
      raffle_host_set_code: {
        Args: { p_pin: string }
        Returns: undefined
      }
      raffle_host_status: {
        Args: Record<string, never>
        Returns: Json
      }
      raffle_host_set_mode: {
        Args: { p_token: string; p_mode: string }
        Returns: undefined
      }
      guest_photos_info: { Args: Record<string, never>; Returns: Json }
      guest_photo_start: { Args: { p_name: string }; Returns: Json }
      guest_photo_left: { Args: { p_token: string }; Returns: Json }
      guest_photo_reserve: { Args: { p_token: string; p_count: number }; Returns: Json }
      guest_photo_confirm: { Args: { p_token: string; p_ids: string[] }; Returns: Json }
      guest_photo_list: { Args: { p_before?: string; p_limit?: number }; Returns: Json }
      guest_photo_mine: { Args: { p_token: string }; Returns: Json }
      guest_photo_remove: { Args: { p_token: string; p_id: string }; Returns: boolean }
      public_music: { Args: Record<string, never>; Returns: Json }
      suggest_guest_name: { Args: { search_name: string }; Returns: string | null }
      raffle_host_new_round: {
        Args: { p_token: string }
        Returns: undefined
      }
      card_back_prefs: {
        Args: Record<string, never>
        Returns: Json
      }
      invitation_card_details: {
        Args: { p_invitation_id: string }
        Returns: {
          position_mode: string
          position_label: string | null
          position_member_id: string | null
        }[]
      }
      record_invitation_open: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      open_invitation: {
        Args: { invite_code: string }
        Returns: {
          invitee_name: string
          included_guests: string[]
          attendance_status: string | null
          position_mode: string
          position_label: string | null
          position_member_id: string | null
          addressed_as: string | null
        }[]
      }
      find_invitation_by_code: {
        Args: { invite_code: string }
        Returns: {
          invitation_id: string
          invitee_name: string
          table_number: string | null
          max_additional_guests: number
          has_existing_response: boolean
          included_guests: string[]
        }[]
      }
      submit_rsvp: {
        Args: {
          p_invitation_id: string
          p_attendance_status: string
          p_has_transportation?: boolean | null
          p_needs_transportation?: string | null
          p_vehicle_type?: string | null
          p_coming_from?: string | null
          p_food_preferences?: string[]
          p_has_food_restrictions?: boolean | null
          p_food_restrictions?: string | null
          p_accessibility_needs?: string | null
          p_additional_guests?: string[]
          p_message_to_couple?: string | null
          p_mobile_number?: string | null
          p_custom_answers?: Json
        }
        Returns: {
          rsvp_id: string
          attendance_status: string
        }[]
      }
      admin_set_included_guests: {
        Args: { p_invitation_id: string; p_names: string[] }
        Returns: number
      }
      admin_include_invitation: {
        Args: { p_from: string; p_into: string }
        Returns: string
      }
      admin_separate_guest: {
        Args: { p_guest: string }
        Returns: string
      }
      rsvp_is_open: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_public_gift: {
        Args: Record<PropertyKey, never>
        Returns: { title: string | null; message: string | null; qr_image_url: string | null }[]
      }
      admin_record_rsvp: {
        Args: { p_invitation_id: string; p_status: string; p_mobile_number?: string | null }
        Returns: string
      }
      get_invitation_table: {
        Args: { p_invitation_id: string }
        Returns: string | null
      }
      find_my_seat: {
        Args: { search_name: string }
        Returns: Json
      }
      get_invitation_seat: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      get_invitation_gift: {
        Args: { p_invitation_id: string }
        Returns: { title: string | null; message: string | null; qr_image_url: string | null }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      normalize_name: {
        Args: { p_name: string }
        Returns: string
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

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
