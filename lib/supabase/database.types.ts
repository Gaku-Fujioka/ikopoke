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
    Views: { [_ in never]: never };
    Functions: {
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
