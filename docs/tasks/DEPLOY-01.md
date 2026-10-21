# DEPLOY-01：独自ドメインでの少人数向け公開

2026-10-21。状態：公開準備中。外部設定・公開HTTP・実ユーザー操作は未確認。本Agent単独。
branch：`chore/production-deployment`、基準main：`27241f943bcc627639429888d613e97c6e259337`。
F-01/02/11/12、N-04/05/07/09/11、D-036。前提：AUTH-06、POCKET-PWA-01。

## Goal・採用範囲

- ユーザーが取得済みの `ikopoke.app` でアプリを使えるようにする。Vercel登録済みとの報告あり。
- 公開時は空の状態で少人数利用を始めたいという希望。新規DB案に対し、ユーザーは既存プロジェクト継続と、公開前のデータ整理の相談を選択。既存アカウント・候補・写真を今すぐ削除する意味ではなく、新しいDBは作らない。
- Node.jsは既存CIと同じ22系をpackage.jsonとlockfileで指定し、依存自体は更新しない。
- 本番metadataは `VERCEL_PROJECT_PRODUCTION_URL`、なければ `VERCEL_URL` を利用。Previewは `VERCEL_URL`、ローカルは従来のlocalhostに戻る。
- VercelのGit接続・Production環境変数、Name.comのDNS、Supabaseの認証URL/メール、Google Mapsの公開ドメイン制限を確認する。設定の具体的な操作はチャットで案内する。

## 対象外・制約

- 公開前の試用データ削除、既存開発DBのmigration再適用、有料契約、Push通知、新しい機能や依存の追加は含めない。
- 既存プロジェクト `gszekiwwrxlkorqfrdvd` の27件のmigrationとdelete-account v2 ACTIVE・verify_jwt=trueを確認。既存migrationとFunctionは再適用しない。
- Productionだけに既存DBの設定値を登録し、Previewへ流用しない。ローカルと公開版が同じデータへ反映される点をユーザーへ説明済み。
- APIキー・パスワード・メールアドレス・利用者データを記録しない。環境変数は名前と用途のみ扱う。
- README変更、旧スターター32件の削除、未追跡pnpmファイルとwork/は既存差分として保全。

## 変更対象・Done・検証

- コード：`package.json`、`package-lock.json`、`app/layout.tsx`。記録：本書、`TASKS.md`、D-036。
- lint・型検査・build・既存の関連テストと自己レビュー後、最新CIを確認。Git変更と外部の公開完了は別に報告する。
- 公開HTTPでHTTPS・未認証時の導線・Manifest/SW/アイコンの配信・metadataの公開URLを確認する。
- ユーザーと登録/メール確認/再ログイン/招待参加/地図を確認する。実スマホPWAと写真付き記録の一連操作は、続く確認として明示する。

## 現在の調査結果

- Vercel連携情報・CLIはローカルに見つからず。接続可能なVercelプラグインを案内済みだが接続未確認。
- 新規DB案の調査でFreeの上限条件を確認したが、ユーザーが既存DBを選択したため作成・費用確認・追加契約は行わない。
- signupとパスワード再設定は閲覧中のoriginから `/auth/callback` を作る既存実装。Supabaseの許可URLとメールテンプレートは公開環境の設定が必要。
- Supabaseの変更履歴を確認。現在のAuth/Storage利用に変更が必要な項目は今回の準備で検出していない。
- ローカル：lint・型検査・関連27テスト・本番build成功。metadataの本番/Preview/本番URLなし/ローカル4条件とpackage/lockのNode指定を一時チェックで確認。恒久的なテストの追加は行っていない。
- 既存DBを件数のみ照会：アカウント3、グループ1、候補2、訪問1、アルバム0、Storage実体0。本文・名前・メールは取得していない。データ整理の最終対象・アカウントを残すかは未決定。
- 公開schemaの通常テーブル26件は全件RLS有効、Storage bucketは1件で非公開。Advisorは従来の限定RPCに関する認証済みSECURITY DEFINER 49件、匿名のrls_auto_enable 1件、漏えいパスワード保護無効を警告。権限の変更は実施せず、警告ゼロと報告しない。参照：[匿名実行](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[認証済み実行](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[パスワード保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- ローカル検証・CI・外部設定・HTTP・実ユーザー操作の最終結果は本タスクのPR/会話へ記録する。未実行を成功扱いしない。

## 根拠

- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Vercel domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
