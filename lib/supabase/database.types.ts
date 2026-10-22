import type {BookContent} from '../memories/book';
import type {FinanceOptions,FinanceDashboard,FinanceDetail,FinanceInput,FinanceHistoryInput} from '../finance/types';
/** Types for repository-owned migrations. Auth remains SDK-managed. */
export type GroupRow = {
  id: string;
  name: string;
  created_by: string;
  deleting: boolean;
  created_at: string;
  description: string;
  cover_media_id: string | null;
  presentation_revision: number;
};

export type Database = {
  public: {
    Tables: {
      item_places: { Row: { item_id: string; group_id: string; place_id: string }; Insert: never; Update: never; Relationships: [] };
      memories: {
        Row: { id: string; group_id: string; outing_id: string; title: string; memory_date: string; note: string; revision: number; created_at: string; cover_photo_id: string | null; memory_end_date: string };
        Insert: never; Update: never; Relationships: [];
      };
      visits: {
        Row: { id: string; group_id: string; item_id: string; outing_id: string | null; item_title: string; visited_on: string; visited_time: string | null; visited_period: "morning" | "noon" | "afternoon" | "night" | null; deleting: boolean; outing_stop_id: string | null; note: string; revision: number; created_by: string; created_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      visit_ratings: {
        Row: { visit_id: string; user_id: string; value: number; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      visit_photos: {
        Row: { id: string; group_id: string; visit_id: string | null; memory_page_id: string | null; slot: number; display_order: number; deletion_actor: string | null; object_path: string; content_type: string; byte_size: number; status: "pending" | "ready" | "cancelling"; created_by: string; created_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      outings: {
        Row: { id: string; group_id: string; title: string; outing_date: string; end_date: string; cancelled_at: string | null; plan_format: number; mode: "exact" | "period" | "order"; memo: string; revision: number; completed_at: string | null; created_by: string; created_at: string; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      outing_items: {
        Row: { id: string; day_index: number; outing_id: string; group_id: string; item_id: string; position: number; planned_time: string | null; period: "morning" | "noon" | "afternoon" | "night" | null };
        Insert: never; Update: never; Relationships: [];
      };
      outing_days: { Row: { outing_id: string; group_id: string; day_index: number; mode: "exact" | "period" | "order"; participants: string[] }; Insert: never; Update: never; Relationships: [] };
      outing_participants: {
        Row: { outing_id: string; group_id: string; user_id: string };
        Insert: never; Update: never; Relationships: [];
      };
      profiles: {
        Row: { user_id: string; display_name: string; updated_at: string; avatar_media_id: string | null; onboarding_version: number };
        Insert: { user_id: string; display_name: string };
        Update: { display_name?: string; updated_at?: string; onboarding_version?: number };
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
        Row: { id: string; item_id: string; body: string; created_by: string; created_at: string; revision: number };
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
        Row: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string; created_by: string; created_at: string; priority: number; archived_at: string | null };
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
      get_memory_book: {Args:{p_memory:string};Returns:BookContent};
      mutate_memory_book: {Args:{p_memory:string;p_operation:string;p_data:Record<string,unknown>};Returns:{id?:string;revision?:number;object_path?:string;status?:string;paths?:string[]}};
      open_memory_book: {Args:{p_group:string;p_outing:string};Returns:string};
      open_finance_context:{Args:{p_kind:string;p_source:string};Returns:string};
      get_finance_options:{Args:{p_context:string|null};Returns:FinanceOptions};
      get_finance_dashboard:{Args:{p_context:string|null;p_month:string|null;p_kind:string;p_page:number};Returns:FinanceDashboard};
      get_finance_entry:{Args:{p_id:string;p_page:number};Returns:FinanceDetail};
      save_finance_entry:{Args:{p_id:string;p_expected:number;p_data:FinanceInput};Returns:number};
      save_finance_payment:{Args:{p_entry:string;p_id:string;p_expected:number;p_payment_revision:number;p_data:FinanceHistoryInput|Record<string,never>;p_delete:boolean};Returns:number};
      delete_finance_entry:{Args:{p_id:string;p_expected:number;p_confirm:boolean};Returns:undefined};
      save_finance_category:{Args:{p_id:string;p_name:string;p_expected:number};Returns:number};
      get_group_presentations: {Args:{p_ids:string[]};Returns:{group_id:string;description:string;cover_id:string|null;cover_path:string|null;revision:number;color:string|null}[]};
      save_group_presentation: {Args:{p_group:string;p_description:string|null;p_expected:number|null;p_color:string|null};Returns:undefined};
      edit_profile_media: {Args:{p_action:string;p_kind:string;p_group:string|null;p_id:string|null;p_expected:string|null;p_size:number|null};Returns:{id?:string|null;path?:string;status?:string}};
      get_profile_editor: {Args:{p_group:string|null};Returns:{id:string|null;path:string|null;unused:{id:string;status:string;can_publish:boolean}[]}};
      preview_group_profile: {Args:{p_token:string};Returns:{group_id:string;group_name:string;expires_at:string;description:string;cover_path:string|null}};
      get_member_avatars: {Args:{p_group:string};Returns:{user_id:string;path:string}[]};
      get_social_avatars: {Args:{p_group:string;p_keys:string[];p_comments:boolean};Returns:{key:string;path:string}[]};
      save_place_item: { Args: { p_group_id: string; p_place_id: string; p_title: string; p_list_ids: string[]; p_request_id: string }; Returns: { item_id: string; reused: boolean; archived: boolean }[] };
      set_item_place: { Args: { p_group_id: string; p_item_id: string; p_place_id: string | null; p_expected_place_id: string | null }; Returns: undefined };
      get_my_group_departures:{Args:Record<string,never>;Returns:{group_id:string;name:string;member_count:number;deleting:boolean}[]};
      get_my_account_deletion:{Args:Record<string,never>;Returns:{request_id:string;state:string;group_ids:string[];delete_group_ids:string[]}[]};
      begin_leave_group:{Args:{p_group_id:string;p_expected_members:number;p_delete_last:boolean};Returns:boolean};
      get_group_cleanup_paths:{Args:{p_group_id:string};Returns:{object_path:string}[]};
      finish_leave_group:{Args:{p_group_id:string};Returns:undefined};
      save_trip: { Args: {p_group_id:string;p_outing_id:string;p_expected_revision:number;p_title:string;p_start:string;p_end:string;p_memo:string;p_days:{mode:string;participants:string[];items:{id:string;item_id:string;planned_time:string|null;period:string|null}[]}[];p_participants:string[];p_removed_ids:string[]}; Returns:number };
      set_outing_cancelled: { Args: {p_group_id:string;p_outing_id:string;p_cancelled:boolean;p_expected_revision:number}; Returns:number };
      record_stop_visit: { Args: {p_group_id:string;p_item_id:string;p_outing_id:string|null;p_stop_id:string|null;p_visited_on:string;p_note:string;p_rating:number|null;p_request_id:string;p_time:string|null;p_period:string|null}; Returns:string };
      get_visit_permissions: { Args: { p_group_id: string; p_visit_id: string }; Returns: { can_delete: boolean; photo_ids: string[] }[] };
      reorder_visit_photos: { Args: { p_group_id: string; p_visit_id: string; p_ids: string[]; p_expected_ids: string[] }; Returns: undefined };
      set_memory_cover: { Args: { p_group_id: string; p_memory_id: string; p_photo_id: string | null; p_expected_revision: number }; Returns: number };
      begin_remove_photo: { Args: { p_group_id: string; p_visit_id: string; p_photo_id: string }; Returns: string | null };
      finish_remove_photo: { Args: { p_group_id: string; p_visit_id: string; p_photo_id: string }; Returns: undefined };
      begin_remove_visit: { Args: { p_group_id: string; p_visit_id: string; p_expected_revision: number }; Returns: { object_path: string }[] };
      finish_remove_visit: { Args: { p_group_id: string; p_visit_id: string }; Returns: undefined };
      browse_items: { Args: { p_group_id: string | null; p_query: string; p_kind: string | null; p_reaction: string | null; p_list_id: string | null; p_unclassified: boolean; p_archived: boolean; p_visited: string | null; p_priority: number | null; p_sort: string; p_page: number }; Returns: { items: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string; created_at: string; priority: number; archived_at: string | null; want_count: number; visited: boolean; score: number; my_reaction: string | null }[]; total_count: number }[] };
      set_item_attributes: { Args: { p_group_id: string; p_item_id: string; p_priority: number; p_expected_priority: number; p_archived: boolean; p_expected_archived: boolean }; Returns: undefined };
      get_named_item_reactions: { Args: { p_group_id: string; p_item_id: string }; Returns: { value: string; display_name: string; is_mine: boolean; total_count: number }[] };
      get_named_item_comments: { Args: { p_group_id: string; p_item_id: string; p_page: number }; Returns: { comments: { id: string; body: string; created_at: string; is_mine: boolean; display_name: string; revision: number; can_delete: boolean }[]; total_count: number }[] };
      edit_item_comment: { Args: { p_group_id: string; p_item_id: string; p_comment_id: string; p_body: string; p_expected_revision: number }; Returns: number };
      delete_item_comment: { Args: { p_group_id: string; p_item_id: string; p_comment_id: string; p_expected_revision: number }; Returns: undefined };
      get_home_activity: { Args: { p_group_id: string | null; p_limit: number; p_before_at: string | null; p_before_key: string | null }; Returns: { event_key: string; group_id: string; kind: string; subject_id: string; title: string; actor_name: string | null; is_mine: boolean; occurred_at: string }[] };
      record_timed_visit: { Args: { p_group_id: string; p_item_id: string; p_outing_id: string | null; p_visited_on: string; p_note: string; p_rating: number | null; p_request_id: string; p_time: string | null; p_period: string | null }; Returns: string };
      update_timed_visit: { Args: { p_group_id: string; p_visit_id: string; p_visited_on: string; p_note: string; p_expected_revision: number; p_time: string | null; p_period: string | null }; Returns: number };
      set_outing_completed: { Args: { p_group_id: string; p_outing_id: string; p_completed: boolean; p_expected_revision: number }; Returns: string | null };
      update_memory: { Args: { p_group_id: string; p_memory_id: string; p_title: string; p_note: string; p_expected_revision: number }; Returns: number };
      record_visit: { Args: { p_group_id: string; p_item_id: string; p_outing_id: string | null; p_visited_on: string; p_note: string; p_rating: number | null; p_request_id: string }; Returns: string };
      update_visit: { Args: { p_group_id: string; p_visit_id: string; p_visited_on: string; p_note: string; p_expected_revision: number }; Returns: number };
      set_visit_rating: { Args: { p_group_id: string; p_visit_id: string; p_value: number | null }; Returns: undefined };
      get_visit_ratings: { Args: { p_group_id: string; p_visit_id: string }; Returns: { rating_count: number; average_rating: number | null; my_rating: number | null }[] };
      reserve_visit_photo: { Args: { p_group_id: string; p_visit_id: string; p_request_id: string; p_content_type: string; p_byte_size: number }; Returns: { photo_id: string; object_path: string; status: "pending" | "ready" | "cancelling" }[] };
      finish_visit_photo: { Args: { p_group_id: string; p_visit_id: string; p_photo_id: string }; Returns: undefined };
      begin_cancel_visit_photo: { Args: { p_group_id: string; p_visit_id: string; p_photo_id: string }; Returns: string };
      cancel_visit_photo: { Args: { p_group_id: string; p_visit_id: string; p_photo_id: string }; Returns: undefined };
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
      create_group_with_profile: {Args:{p_name:string;p_request_id:string;p_description:string};Returns:string};
      create_group_invite: { Args: { p_group_id: string; p_token_hash: string }; Returns: { id: string; expires_at: string }[] };
      preview_group_invite: { Args: { p_token: string }; Returns: { group_id: string; group_name: string; expires_at: string }[] };
      accept_group_invite: { Args: { p_token: string; p_group_id: string }; Returns: string };
      revoke_group_invite: { Args: { p_invite_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
