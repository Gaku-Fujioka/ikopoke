/** Types for repository-owned migrations. Auth remains SDK-managed. */
export type GroupRow = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      outings: {
        Row: { id: string; group_id: string; title: string; outing_date: string; mode: "exact" | "period" | "order"; memo: string; revision: number; created_by: string; created_at: string; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      outing_items: {
        Row: { outing_id: string; group_id: string; item_id: string; position: number; planned_time: string | null; period: "morning" | "noon" | "afternoon" | "night" | null };
        Insert: never; Update: never; Relationships: [];
      };
      outing_participants: {
        Row: { outing_id: string; group_id: string; user_id: string };
        Insert: never; Update: never; Relationships: [];
      };
      profiles: {
        Row: { user_id: string; display_name: string; updated_at: string };
        Insert: { user_id: string; display_name: string };
        Update: { display_name?: string; updated_at?: string };
        Relationships: [];
      };
      lists: {
        Row: { id: string; group_id: string; name: string; created_by: string; created_at: string };
        Insert: { id: string; group_id: string; name: string };
        Update: { name: string };
        Relationships: [];
      };
      item_list_memberships: {
        Row: { item_id: string; list_id: string; group_id: string };
        Insert: { item_id: string; list_id: string; group_id: string };
        Update: never;
        Relationships: [];
      };
      item_comments: {
        Row: { id: string; item_id: string; body: string; created_by: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      item_reactions: {
        Row: { item_id: string; user_id: string; value: "want_to_go" | "not_now"; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      items: {
        Row: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string; created_by: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      groups: {
        Row: GroupRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      group_members: {
        Row: { group_id: string; user_id: string; joined_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      group_invites: {
        Row: { id: string; group_id: string; token_hash: string; created_by: string; created_at: string; expires_at: string; revoked_at: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      shared_item_feed: {
        Row: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string; created_at: string; my_reaction: "want_to_go" | "not_now" | null };
        Relationships: [];
      };
    };
    Functions: {
      save_outing: { Args: { p_group_id: string; p_outing_id: string; p_expected_revision: number; p_title: string; p_date: string; p_mode: string; p_memo: string; p_items: { item_id: string; planned_time: string | null; period: string | null }[]; p_participants: string[] }; Returns: number };
      set_my_display_name: { Args: { p_name: string }; Returns: string };
      get_group_members: { Args: { p_group_id: string }; Returns: { user_id: string; display_name: string | null }[] };
      create_list: { Args: { p_group_id: string; p_name: string; p_request_id: string }; Returns: string };
      rename_list: { Args: { p_group_id: string; p_list_id: string; p_name: string; p_expected_name: string }; Returns: undefined };
      delete_list: { Args: { p_group_id: string; p_list_id: string; p_expected_name: string }; Returns: undefined };
      set_item_list: { Args: { p_group_id: string; p_item_id: string; p_list_id: string; p_selected: boolean }; Returns: undefined };
      get_item_lists: { Args: { p_group_id: string; p_item_id: string; p_query: string; p_page: number }; Returns: { lists: { id: string; name: string; is_selected: boolean }[]; total_count: number }[] };
      get_group_items: { Args: { p_group_id: string; p_query: string; p_kind: string | null; p_reaction: string | null; p_list_id: string | null; p_unclassified: boolean; p_page: number }; Returns: { items: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string; created_at: string }[]; total_count: number }[] };
      rename_group: { Args: { p_group_id: string; p_name: string; p_expected_name: string }; Returns: string };
      create_item_comment: { Args: { p_group_id: string; p_item_id: string; p_body: string; p_request_id: string }; Returns: string };
      get_item_comments: { Args: { p_group_id: string; p_item_id: string; p_page: number }; Returns: { comments: { id: string; body: string; created_at: string; is_mine: boolean }[]; total_count: number }[] };
      update_item: { Args: { p_group_id: string; p_item_id: string; p_title: string; p_memo: string; p_expected_title: string; p_expected_memo: string }; Returns: string };
      get_item_reactions: { Args: { p_group_id: string; p_item_id: string }; Returns: { want_count: number; not_now_count: number; my_reaction: "want_to_go" | "not_now" | null }[] };
      set_item_reaction: { Args: { p_group_id: string; p_item_id: string; p_value: string | null }; Returns: undefined };
      create_item: { Args: { p_group_id: string; p_title: string; p_kind: string; p_memo: string; p_request_id: string }; Returns: string };
      create_group: { Args: { p_name: string; p_request_id: string }; Returns: string };
      create_group_invite: { Args: { p_group_id: string; p_token_hash: string }; Returns: { id: string; expires_at: string }[] };
      preview_group_invite: { Args: { p_token: string }; Returns: { group_id: string; group_name: string; expires_at: string }[] };
      accept_group_invite: { Args: { p_token: string; p_group_id: string }; Returns: string };
      revoke_group_invite: { Args: { p_invite_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
