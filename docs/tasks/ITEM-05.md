# ITEM-05：種類と自分の反応による絞り込み

作成日：2026-10-18。状態：[PR #13](https://github.com/Gaku-Fujioka/kokoiko/pull/13)でmain統合・CI成功。実DB適用version `20261017162907`と定義・invoker設定・権限の検証成功はユーザー報告済み。実画面確認待ち。担当：本Agent単独。
branch：`feat/shared-candidate-tools`。基準：`3b202a8`。F-05、N-02/03/04/07。

## Goal・範囲・Done

既存デモの種類・自分の反応フィルターを共有候補に移す。名前検索との併用、詳細・ページ送り・認証後復帰の条件保持、0件・解除に対応する。
`kind=spot/activity`、`reaction=want_to_go/not_now/unreacted`だけを受け付け、不正値・複数値は条件なしへ正規化する。GETの再検索では先頭ページへ戻る。
他者の反応や「みんなが行きたい」の定義、分類・訪問済みは対象外。

## 実装と検証

- `shared_item_feed`は`security_invoker=true`を指定し、元の候補と本人の反応のRLSを適用する。公開はauthenticatedのSELECTのみ。
- 本人の反応がない状態と「そこまで」を区別する。DBで絞り込み後に件数と20件ごとのページを取得する。
- 名前・種類のみの検索は既存itemsを使い、追加view未適用でも既存の閲覧を維持する。
- 反応保存時に一覧も再取得対象へ追加する。
- 公式根拠：[Supabaseの安全なview](https://supabase.com/docs/guides/database/postgres/row-level-security#expose-a-view-safely)、[PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)。PostgreSQL 15以上が必要。
- PostgreSQLでRLS・別グループ・他者の反応混入防止を検証。実SDKの合成HTTP transportが作る条件を加工せずSQLへ渡し、検索・種類・反応・未反応・ページと件数を確認する。実PostgRESTサーバー検証とは区別する。
- ユーザーのDB適用・定義検証は報告済み。実画面確認は他の機能とまとめる。CI・統合結果は[今回のまとめ](SHARED-TOOLS-01.md)に記録する。

主な対象：共有候補の一覧・詳細、`lib/items/search.ts`とrepository、DB型、view migration、関連テスト。新しい依存・外部APIは追加しない。
