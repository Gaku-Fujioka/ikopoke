# Data Model Draft

これは初期設計。実装前に必要性を再確認し、DB変更はmigrationとして管理する。

## profiles

- id (uuid, auth.usersと対応)
- display_name
- avatar_url
- created_at

## groups

- id
- name
- created_by
- created_at

## group_members

- group_id
- user_id
- joined_at

## lists

- id
- group_id
- name
- created_by
- created_at

## items

場所とやりたいことの共通部分。

- id
- group_id
- list_id (nullable)
- type (`spot` / `activity`)
- title
- description
- priority
- status
- created_by
- created_at
- updated_at

status候補：

- `active`
- `visited`
- `archived`

## spots

item.type = spot の詳細。

- item_id
- place_id
- address
- latitude
- longitude
- photo_reference等
- website_url

## reactions

- id
- item_id
- user_id
- reaction_type (`want_to_go` / `not_interested`)
- created_at

item_id + user_id は重複させない設計を検討。

## comments

- id
- item_id
- user_id
- body
- created_at
- updated_at

## outings

- id
- group_id
- title
- outing_date
- planning_mode (`exact_time` / `time_period` / `no_time`)
- status (`planning` / `upcoming` / `in_progress` / `completed`)
- created_by
- created_at

## outing_items

- id
- outing_id
- item_id
- sort_order
- start_time (nullable)
- time_period (nullable)
- memo

## anniversaries

- id
- group_id
- title
- anniversary_date
- repeat_yearly
- memo
- created_by

## memories

- id
- outing_id
- title
- cover_photo_path
- created_at
- updated_at

## memory_entries

- id
- memory_id
- outing_item_id (nullable)
- photo_path (nullable)
- memo
- sort_order
- created_at

## RLSの考え方

基本原則：

「そのrowが属するgroupの `group_members` に現在ユーザーが存在する場合のみアクセス可能」

MVPではメンバー全員編集可。ただし将来的な権限追加に耐えられる構造を意識する。
