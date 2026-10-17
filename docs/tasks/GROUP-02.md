# GROUP-02：グループ作成と所属の永続化

作成・更新日：2026-10-17。状態：ローカル検証・CI成功。実DBへの適用・実ブラウザ確認は未実施。統合方針はD-009。
優先A。F-02、N-02/03/04/06/10、D-008、Q-02/03。

## Goal・範囲

認証済みユーザーが名前を入力して1人のグループを作り、自分が所属するグループを一覧・詳細で開く。
URLでグループを識別し、別グループのIDを直接指定した取得もRLSで拒否する。
グループと作成者の所属をtransactionで保存し、同じ送信UUIDによる再実行で重複させない。

対象：`app/app/groups/`、`components/groups/`、`lib/groups/`、DB型、既存Serverクライアントの型、共通枠、
`supabase/migrations/20261017000100_create_groups.sql`、回帰テスト、CI、テスト用依存、採用・結果の記録。
招待・グループ名編集・メンバー一覧・除外・退会・削除・候補等のDB移行は対象外。通常管理を全員にする方針はD-008で採用済み。

## Doneと実装

- グループ作成・所属の保存・一覧・詳細の切替を実装。実DBの適用前は「準備中」を表示し、空の保存済み一覧や保存成功とは扱わない。
- 作成者は`auth.uid()`を使用。直接のテーブル更新権限は付けず、初期所属を作る限定RPCを認証済みロールにだけ許可する。
- 公開スキーマの2テーブルへRLSを設定し、SELECTと関数実行を明示的にgrantする。SECURITY DEFINERは検索パスを固定し、PUBLIC実行権限を取り消す。
- UUIDが同じでも別ユーザーや異なる内容の再実行は拒否。所属の保存に失敗した場合はグループも巻き戻す。
- 作成後は一覧のキャッシュを再検証。無効なID・非所属・欠落IDはグループ名を表示しない。
- 既存P1デモは固定のローカル保存のまま。実グループ名をデモの共有先に見せない。

## Verification

- `npm run lint`、`npx tsc --noEmit`、34件のNodeテスト、`npm run build`を実施。
- テスト対象は既存3ファイルと`group-actions.test.mjs`・`group-database.test.mjs`。CIの実行対象も更新。
- RLSテストはPGliteのPostgreSQLと実ロールでmigration本体を実行し、匿名・所属・非所属・偽装・重複・原子性を検証する。
  AuthのJWT検証と実Supabaseの接続は別であり、PGliteの成功で実接続済みとは扱わない。
- Dockerは停止中。既存pnpm版node_modulesを保護し、`@electric-sql/pglite` 0.5.10をテスト専用devDependencyとして1つ追加。
  ローカルでは同じ版を一時ディレクトリに導入し、`KOKOIKO_PGLITE_MODULE_URL`で場所を指定した。CIは`npm ci`のロック版を使用する。
- 実Supabaseのスキーマ・migration履歴・所属別のREST操作は、管理接続が確認できていないため未確認・未適用。
  publishable keyによる匿名OpenAPI取得は401で、テーブル不存在の根拠にはしない。
- ブラウザ操作用ツールの利用可能ブラウザは空。モバイル幅・キーボード・実ログインでのグループ作成は未確認。

## 担当・Git・レビュー

本Agentが単独担当。branch：`feat/group-persistence`。基準：認証ブランチの`182fc8b`。追加Agentは起動しない。
開始前のREADME編集、旧スターター削除、未追跡pnpmファイル、ローカル環境変数は変更・stageしない。
自己レビュー後、`adcf3c3`のGitHub CIでlint・型・34件のNodeテスト・build成功を確認。
当初は認証ブランチ基準のDraft PRとしていたが、ユーザーが別の人間レビューを待たない統合を明示した（D-009）。
認証PR #1はmainへマージ済み。[PR #2](https://github.com/Gaku-Fujioka/kokoiko/pull/2)の基準をmainへ変更し、最新差分とCIを確認してAgentが統合する。独立レビューは未実施。
実DB適用は、開発プロジェクトの既存テーブルと履歴を確認してから行う。既存オブジェクトがあればmigrationを無条件に適用しない。

## 次に必要な操作

Supabase連携の接続を確認し、開発DBを読み取り調査する。その後migrationを適用し、ユーザーの実アカウントで作成・再読込・別グループへの切替を確認する。
操作の案内はチャットで行い、キーやCookieやパスワードを要求しない。実データ適用とCIの結果は実施後に記録する。
