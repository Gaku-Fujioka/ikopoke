# MAP-03：見つける・保存する・計画するを地図でつなぐ

2026-10-18。担当：本会話のAgent単独。branch: feat/map-saved-places。
F-04/05/08/12、N-01/02/04/06/08。ユーザーが提案1〜3の一括実装を依頼。

- 検索結果から所属グループ・任意の複数リストへ候補を保存。同じグループの同じ場所は既存候補を案内し、アーカイブを勝手に復元しない。保存と分類は一つのDBトランザクション。
- 既存の手入力スポットに場所を紐づけ/変更/解除でき、変更時は競合を検出する。やりたいことには紐づけない。
- 全グループ/選択グループの保存候補を地図で表示。位置は場所IDから明示操作時に取得し、1回最大20件。未連携や取得不能の候補を架空のピンにしない。
- 計画詳細で日ごとに行き先のピンを表示し、順番の一覧から各スポットへのGoogleマップ道案内へ進める。線/経路計算/所要時間APIは追加しない。繰返しの行き先は一覧に残す。
- DBへGoogleコンテンツを複製しない。保存はplace IDとユーザー自身の呼び名のみ。呼び名の初期値はユーザーの検索語（APIの名称ではない）。写真/口コミ/座標/住所は画面内だけ。既存候補は移行で変更しない。
- 所属RLS、原子的な重複防止、退出/削除ガード、既存グループ削除のCASCADEを検証する。

対象：lib/maps、components/maps、ホーム・候補詳細・計画詳細、限定したAction、DB型、migration、テスト・CI・関連文書。
対象外：Auth/SMTP/公開設定/キー/予算/依存の変更、現在地、経路API、Google写真のアプリStorage保存。
既存README・旧資料削除・pnpm/work・.env.localは保護。設定手順はチャットで案内する。

検証：ローカルPGliteによる所属/非所属/匿名/制約/重複/競合/ロールバック/削除・移行保全、偽SDKによるID解決/ピン/失敗/中断/呼出し回数、UIとリンク、lint・型・build・関連および全体テスト、固定差分の自己レビュー、最終head CI。実ブラウザは接続可否を確認して別記する。
公式：Google [保存条件](https://developers.google.com/maps/documentation/places/web-service/policies)、[Details](https://developers.google.com/maps/documentation/javascript/place-details)、[Maps URLs](https://developers.google.com/maps/documentation/urls/guide)、Supabase [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。changelogの直近変更も確認、対象の既存supabase-js/SSR方式に影響する変更はない。

## 実装・検証記録

- CLI 2.121.0のmigration newで作成。開発プロジェクト「ここいこ」にsaved_place_linksを実version 20261018085953で適用済み。ローカル名を実履歴に同期し、SQL本文は変更していない。
- 実DBで新規5関数の本体がローカルと一致。公開2関数はSECURITY INVOKER、権限付き処理は非公開スキーマで認証・所属・削除状態を検証し、空のsearch_pathを設定。補助ロック関数はauthenticatedにも実行不可。
- 新テーブルはRLS有効、所属SELECTポリシー1件。anonはSELECT不可、authenticatedはSELECTのみで直接書込不可、service_roleも直接データ操作不可。既存データ・Auth情報は読み出していない。
- Security Advisorの件数は適用前後で不変、新規対象の指摘なし。既存のrls_auto_enable、公開済み既存関数、漏えいパスワード保護の指摘は今回変更しない。Performance Advisorの複合外部キー索引不足1件は別migration index_saved_place_foreign_key（実version 20261018090151）で解消済み。新設索引の未使用INFOのみ残る。索引追加後のDB/移行保全4件も成功。
- 初回全体検証で既存の合成DBにservice_roleがない点と、追加した独立Suspense境界に未対応のテストを検出し修正。全310件のNodeテスト・lint・型検査・本番build成功。追加の場所解決では4件並列、欠落場所の分離、同一IDの画面内再利用、中断後の追加呼出し停止を検証した。
- 自己レビューでは入力の限定、同時保存のグループ単位直列化、冪等性、分類失敗のロールバック、退出/削除・CASCADE、古い紐づけの拒否、アーカイブ保全、APIデータ非保存、既存候補の地図未連携と繰返し訪問の順序を確認。D-009に基づく単独自己レビューで独立レビューなし。
- 実画面とGoogleへの実リクエストはAgent未検証。ユーザーに保存→再表示→重複→計画の操作確認をチャットで依頼済み。CIとmain統合は当変更のPRで記録する。
