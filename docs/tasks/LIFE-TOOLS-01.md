# LIFE-TOOLS-01：共有の整理・旅行・アルバムを仕上げる

2026-10-18。状態：実装・開発DB反映済み、実画面確認待ち。担当：本Agent単独。branch `feat/shared-life-tools`、基準 `c08602f`。
F-01/02/04/05/06/08/09/10/11、N-01/02/03/04/05/06/07/09/10。Q-02/05/07/09/12の今回の回答範囲を採用。

## Goal / 採用済み

全質問への回答後、一括実装するという指示。既存の温かいモバイルUI・RLS・改訂による競合検知を再利用する。

1. 候補詳細の反応者/コメント投稿者名。コメントは本人だけ編集・削除、退出者の投稿は残ったメンバーが削除可能。
2. 候補は全員がアーカイブ/復元。通常一覧と新規計画選択から外し、既存計画/記録は保持。共通優先度は高3/中2/低1/未設定0。おすすめ順は行きたい人数+優先度点、そこまでの減点なし、同点は人数→作成日時→ID。訪問済みは同グループの訪問記録1件以上。
3. 計画は全員が中止/再開、記録/アルバム保持。中止中は通常のカレンダーと次の予定に出さない。
4. 訪問記録/写真の削除は作成者/アップロード本人。本人が退出済みなら残ったメンバーも削除可。訪問記録全体の削除は、確認の上で他人の写真も含めて削除できる。Storage実体はAPIで削除し、途中失敗は再試行できる。
5. 退出/アカウント削除後も共有記録を残し、退出したメンバーと表示。最後の1人の退出は、確認してグループ/全記録/写真を削除する。メンバー除外や、他メンバーがいるグループの一括削除は対象外。
6. 表紙はアルバム内の訪問写真から任意選択、一覧にも表示。訪問ごとの写真順を共有編集し、記録とアルバムで同じ順を使う。選択写真の削除時は表紙未設定へ戻す。
7. 単日と複数日を同じ計画で扱い、開始/終了日必須。日ごとの3モード・参加者、旅行全体の参加者からの日別初期入力。同じ候補を同日/別日へ繰り返し追加可能。開始日変更は日数と日別内容を保って移動、訪問済みの実際の日付は変えない。短縮で範囲外に候補が残る場合は保存を拒否し、先に移動/取外しを案内。

## 実装順 / 対象

A：候補の属性/検索・名前とコメント操作。B：写真順/表紙/削除。
C：日別旅行・中止とカレンダー/訪問連携。D：退出/アカウント削除・保全。
各段階をmigration・repository/Action・画面・実Postgresテストで小さく検証してcommitする。
`app/app/groups/`、`components/items|visits|memories|outings|groups/`、`lib/`の対応領域、
`supabase/migrations/`・必要な自己削除用Edge Function、型・tests・CI・判断/進捗文書。

## Constraints / Done

既存レコードを変換するmigrationは履歴・写真の実体を保持。権限は直接RPC/Storage経路でも検証。
新規API課金/SMTP/PWA/通知/地図/記念日/公開サイトのdeployは対象外。
アカウント削除用の秘密鍵はClientやローカル設定へ出さず、開発用Supabaseのサーバー内で本人確認する。
実ユーザーの破壊的テストは行わない。削除/退出の動作テストは合成データで実施する。
README・旧スターター削除・pnpm・work/・環境変数は既存変更として保護する。

- [x] 各要件のコードとDB/Storageの所属・本人制限・競合・再送・途中失敗を検証。
- [x] 既存データの変換と旧APIからの抜け道を検証。
- [x] lint・型・全Nodeテスト・build、固定差分の自己レビュー。
- [x] 開発DB適用/定義/権限を記録。PR/mainのCIと統合状態は下のGitHub記録を正本とする。
- [ ] ユーザー確認と必要な操作は最後のチャットに集約する。

## 結果 / 小さい仮定

ローカル実装：A/Bを46c6b92、Cを35cab05、Dをf7a24bd、表紙等の調整をa776700でcommit。254件の全テスト成功。
写真なし/表紙なしも可。新しい写真は並びの末尾、削除しても他写真の順序は保持。
日付は既存どおり日本のカレンダー日付として扱い、時差で変換しない。空の日も旅行に含められる。
旅行の終了/取消は全体単位で1冊を保持。既存単日データを初日の内容として引き継ぐ。
アーカイブ候補は既存計画の編集で保持できるが、新しい立ち寄りとしての追加は拒否する。

アカウント削除は共有写真を保持するためAuthの不可逆soft deletionを使い、識別行/profileは匿名化して残す。EdgeでgetUserと5分以内の再認証を確認する。privateの削除状態と全書き込みガードで有効期限内JWTによる復活を防ぐ。
小さい運用上限：旅行366日・行き先50件・参加者50人。写真の表紙選択は12枚ごとのページ、一覧表紙は近くの画像から認証付きで取得。表紙選択と本文編集は同じアルバム改訂を使い、古い入力は再読込で確認する。
自己レビューで、RLSによる他人の所属行の非表示を「作者が退出した」と誤判定しないようprivateの所属判定を使うこと、本人再確認から関数へパスワードを渡さないこと、旧RPCと送信中Storage経路の競合も確認した。

## 開発Supabase反映（2026-10-18）

対象は既知の開発プロジェクト gszekiwwrxlkorqfrdvd。下記4件はapply_migration成功、履歴を確認しSQL本文を変えずローカル名を実versionへ同期した。

| migration | 実version |
|---|---|
| shared_candidate_tools | 20261018041048 |
| shared_album_tools | 20261018041054 |
| daily_trip_plans | 20261018041101 |
| shared_account_lifecycle | 20261018041108 |

36関数の本体ハッシュを投入SQLと照合し、存在・search_path・実行権限も確認。一切の新規関数はanonから実行不可。アカウント用4関数はauthenticated不可・service_roleだけ実行可、内部関数は必要なRLSヘルパー2件以外client実行不可。対象6テーブルのRLS有効を確認。
適用前後の集計件数は一致：groups 2 / members 2 / items 3 / comments 1 / outings 2 / outing_items 3 / participants 2 / visits 3 / photos 3 / memories 1 / Storage実体3。ユーザーの本文・メール・認証情報・写真の中身は取得していない。

Edge Function delete-account v1 ACTIVE、verify_jwt=true。実行時にgetUserと直近の再認証も確認。未認証/無効トークンの実HTTPは両方401。実アカウント削除と実Storage削除の試験は行っていない。関数の順序・失敗/再試行とDB削除は合成環境で検証した。

Advisorでは新しい匿名実行・RLS欠落・外部キー索引不足を検出しなかった。認証済みSECURITY DEFINERは今回の限定RPC構成による指摘。既存のrls_auto_enable匿名実行、漏えいパスワード保護無効、groups.created_byとitem_list_membershipsの索引不足2件は残る。今回の対象外として設定は変更しない。
参照：[SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[既存の匿名実行](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[パスワード保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。

254件全Nodeテスト・lint・Next型検査・Edge handler型検査・production build成功。独立レビューと実ブラウザ操作は未実施。自己レビューでは権限の直接経路、本人と退出者、旧APIの保護、削除途中、改訂衝突、既存単日データの移行、HTMLの入れ子と写真読み込み量を確認し修正した。GitHubの最新状態は下記の記録を参照する。

## GitHubと最終差分

[PR #26](https://github.com/Gaku-Fujioka/kokoiko/pull/26)。初回head 1ee6f1aの[CI](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39096486548)は成功。最終レビューで、反応→全グループおすすめ順、訪問作成/削除→訪問済みフィルター、写真削除→表紙一覧、旅行編集→アルバムの更新対象を追加し、255件の全テスト・lint・型・buildが成功した。SQL/Edgeの再変更はない。
最新headのCIとmain統合はPRのchecks/merge状態を正本とし、D-009の自己レビュー・必要な検証・最新CI成功・競合なしを確認してAgentが統合する。結果は完了時のチャットへ記載する。実ブラウザの幅/クリック/ログイン後操作はユーザー確認待ち。最後の1人の退出とアカウント削除の実操作は、テスト用グループ/アカウントだけで確認する。

### 中止アルバムの表示の追補

PR #26はmain a62df3043732a370f855966adc1c9a49da3ce9d9へマージされ、[main CI](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39097006380)も成功。その後の画面照合で、中止計画のアルバムにも終了操作が残ることを見つけたため、fix/cancelled-album-controlsで中止中の案内と再開リンクへ揃えた。表紙・本・訪問記録はそのまま利用できる。中止/通常2ケースを追加し、全257件・lint・型検査成功。SQLとEdgeは変更しない。追補のPR/main CIと統合結果はGitHubの同branchのPRと完了チャットへ記録する。
