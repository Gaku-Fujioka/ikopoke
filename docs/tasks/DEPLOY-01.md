# DEPLOY-01：独自ドメインでの少人数向け公開

2026-10-21。状態：コード準備のmain統合・試用データ初期化・Vercel公開・独自ドメインHTTPS確認済み。公開版Safariの登録/確認/再ログインはユーザー報告。メール認証後の招待復帰を調整中。本Agent単独。
branch：`chore/production-deployment`、基準main：`27241f943bcc627639429888d613e97c6e259337`。
初期化結果の記録branch：`docs/production-data-reset`、基準main：`b51b6ffc14c4c80dc2e5cac39501b8e2c40db71d`。
F-01/02/11/12、N-04/05/07/09/11、D-036。前提：AUTH-06、POCKET-PWA-01。

## Goal・採用範囲

- ユーザーが取得済みの `ikopoke.app` でアプリを使えるようにする。Vercel登録済みとの報告あり。
- 公開時は空の状態で少人数利用を始めたいという希望。新規DB案に対し、ユーザーは既存プロジェクト継続を選択。データ整理の範囲を提示した後、「アカウント含めて削除して大丈夫」と明示許可し、試用データを初期化した。新しいDBは作らない。
- Node.jsは既存CIと同じ22系をpackage.jsonとlockfileで指定し、依存自体は更新しない。
- 本番metadataは `VERCEL_PROJECT_PRODUCTION_URL`、なければ `VERCEL_URL` を利用。Previewは `VERCEL_URL`、ローカルは従来のlocalhostに戻る。
- 公開リンクに残っていたNext.js/SupabaseスターターのOG/Twitter画像を、承認済みポケットの静的1200×630px画像と日本語の代替文へ置換。既存生成scriptに含め、フォントや新しい依存を使わない。
- VercelのGit接続・Production環境変数、Name.comのDNS、Supabaseの認証URL/メール、Google Mapsの公開ドメイン制限を確認する。設定の具体的な操作はチャットで案内する。

## 対象外・制約

- 当初は試用データ削除を含めなかったが、今回の明示許可でアカウント込みの初期化を実施。既存DBのmigration再適用、有料契約、Push通知、新しい機能や依存の追加は含めない。
- 既存プロジェクト `gszekiwwrxlkorqfrdvd` の27件のmigrationとdelete-account v2 ACTIVE・verify_jwt=trueを確認。既存migrationとFunctionは再適用しない。
- Productionだけに既存DBの設定値を登録し、Previewへ流用しない。ローカルと公開版が同じデータへ反映される点をユーザーへ説明済み。
- APIキー・パスワード・メールアドレス・利用者データを記録しない。環境変数は名前と用途のみ扱う。
- README変更、旧スターター32件の削除、未追跡pnpmファイルとwork/は既存差分として保全。

## 変更対象・Done・検証

- コード：`package.json`、`package-lock.json`、`app/layout.tsx`、既存のアイコン生成scriptとOG/Twitter画像・代替文。記録：本書、`TASKS.md`、D-036。
- lint・型検査・build・既存の関連テストと自己レビュー後、最新CIを確認。Git変更と外部の公開完了は別に報告する。
- 公開HTTPでHTTPS・未認証時の導線・Manifest/SW/アイコンの配信・metadataの公開URLを確認する。
- ユーザーと登録/メール確認/再ログイン/招待参加/地図を確認する。実スマホPWAと写真付き記録の一連操作は、続く確認として明示する。

## 公開準備時の調査結果（後続の結果は末尾）

- Vercel連携情報・CLIはローカルに見つからず。接続可能なVercelプラグインを案内済みだが接続未確認。
- 新規DB案の調査でFreeの上限条件を確認したが、ユーザーが既存DBを選択したため作成・費用確認・追加契約は行わない。
- signupとパスワード再設定は閲覧中のoriginから `/auth/callback` を作る既存実装。Supabaseの許可URLとメールテンプレートは公開環境の設定が必要。
- Supabaseの変更履歴を確認。現在のAuth/Storage利用に変更が必要な項目は今回の準備で検出していない。
- ローカル：lint・型検査・関連27テスト・本番build成功。metadataの本番/Preview/本番URLなし/ローカル4条件とpackage/lockのNode指定を一時チェックで確認。恒久的なテストの追加は行っていない。
- 共有画像置換後もlint・PWA10テスト・本番build成功。1200×630pxと代替文を確認し、画像を目視確認。一時本番サーバーでログイン画面のOG/Twitter代替文と画像のHTTP200/PNG配信（3リクエスト）を確認して停止。公開サイトや実ブラウザの検証とは区別する。
- 初期化前に件数のみ照会：アカウント3（利用中2・削除済み残存1）、グループ1、候補2、訪問1、アルバム/会計明細/Storage実体0。本文・名前・メールは取得していない。
- 公開schemaの通常テーブル26件は全件RLS有効、Storage bucketは1件で非公開。Advisorは従来の限定RPCに関する認証済みSECURITY DEFINER 49件、匿名のrls_auto_enable 1件、漏えいパスワード保護無効を警告。権限の変更は実施せず、警告ゼロと報告しない。参照：[匿名実行](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[認証済み実行](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[パスワード保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- ローカル検証・CI・外部設定・HTTP・実ユーザー操作の最終結果は本タスクのPR/会話へ記録する。未実行を成功扱いしない。

## 2026-10-21：公開前の初期化

- ユーザーがアカウント込みの削除を明示許可。対象は既知の既存プロジェクト `gszekiwwrxlkorqfrdvd` のみで、プロジェクト情報と外部キー・トリガーを再確認した。
- Supabase公式のユーザー削除とStorage所有・JWTの注意点を確認。Storage実体が0件であることをガードし、同じトランザクションで対象29テーブルを明示してCASCADEなしで空にし、Authのセッション・更新トークン・ログインフローと全3アカウントを削除。個別のAuth識別情報は取得/出力せず、アカウントに紐づくidentity等は既存の外部キーで連鎖削除する。
- テーブル一覧・承認時点の主な件数が変わった場合は中断するガードと、ロック待ち/実行時間の上限を設定。まず実処理をROLLBACKして元の件数に戻ることを確認し、同じ処理を本実行した。
- 結果：アプリのpublic 26表と非公開3表すべて0件、Auth users/identities/sessions/refresh_tokens/flow_stateとStorage実体も0件を確認。テーブル・RLS・DB関数の定義を集約したハッシュは前後一致。migration 27件、非公開bucket 1件、公開表のRLS欠落0件を確認。
- スキーマ変更・migration・メール設定・キー・Functionの更新は行っていない。既存JWTの有効期限はアカウント削除だけで短縮されないが、更新用セッションは削除済み。新規利用は新しいアカウントで登録する。
- VercelのImport画面でユーザーが環境変数設定完了を報告、スクリーンショットはProduction選択を確認できた。値の内容・初回デプロイ・DNS接続・公開URLでの認証はまだ未確認。
- 文書のみの差分は内容・参照リンク・git diffを自己レビュー。アプリコードの変更はなく、この記録のためにローカルbuild/テストは実行しない。PR #41の統合後CIは成功確認済み。この記録のCI/統合状態は記録PRのChecksに従う。

## 2026-10-21：公開・スマホ認証と招待復帰の修正

- ユーザーがGitHubリポジトリを `Gaku-Fujioka/ikopoke` へ変更。ローカルの作業場所は従来のkokoikoを継続し、originは改名先へ更新した。
- VercelのProduction Ready画面とmainのPR #41のデプロイをユーザーが提示。Name.comのルートAとwww CNAMEをVercel指定値へ接続し、メール用DNSは保持した。Agentはルート/wwwのHTTPS応答とwww側のログイン画面への到達を確認した。正規URLは `https://www.ikopoke.app`、ルートはwwwへ転送。ユーザーがSupabaseのSite URL/許可するcallback URLを保存したと報告。
- Safari通常タブの登録とメールからの認証が失敗し、同じメールをPCで開くと登録できたとの報告。元のメール本文にはConfirmationURLを使っていた。アプリの一般的な確認エラー表示だけでは、実際の期限切れ・ブラウザ情報の欠落等を区別できない。ログの状態とエラー分類は確認したが、初回失敗との対応・根本原因は未特定。Safari非対応や登録済みアドレスが原因だったとは断定しない。
- Agentが既存TokenHash/verifyOtp方式への切り分けを提案し、ユーザーが確認メール本文を変更。公開版Safariで新規登録・メール確認後のホーム到達・ログアウト・再ログイン成功を報告した。Agentによる実スマホ操作ではない。
- 修正branch：`fix/email-confirmation-return`、基準main：`afd71fd79a3540d0b904f36ef4f617d36318cc88`。F-01/02、N-04/05、D-010/036。対象は `app/auth/confirm/route.ts` と既存 `tests/auth-handlers.test.mjs`、本書/TASKS/decisions/data-modelの記録。既存の未コミット変更は保全。
- 通常登録で成功した確認メールは戻り先を持たず、招待経由でも全体ホームへ進む。この差分では、URLエンコードしたRedirectToをメールの `redirect_to` に持たせ、同一origin・認証情報を含まない `/auth/callback` から `next` だけ取り出す。取り出した値は既存のアプリ内パス検証へ渡す。明示的な `next` を優先し、recoveryは従来どおり再設定画面へ固定。新しい依存やDB変更は不要。
- 招待tokenのCookieは参加画面だけへ送信される従来のPathを維持し、認証URLやメールには転記しない。同じブラウザでの招待復帰を対象とし、別ブラウザでは招待リンクを開き直す既存ルールを維持する。
- Done：招待への復帰・クエリ保持・外部origin/ポート違い/認証情報付きURL/想定外のルート/外部next拒否・認証失敗時の固定URL・recovery固定先を実ハンドラーのprovider stubで検証し、lint/型/buildと自己レビュー、最新CIを確認。実Supabaseとの通信・実メールの招待復帰はユーザーの操作確認と区別する。
- 認証・招待・登録エラーの関連37テスト、lint・型検査・本番build成功。差分を自己レビューし、外部転送/秘密情報の保持、Cookieの送信範囲と参加時の認証/所属確認が変わらないことを確認。独立レビューは未実施。既存のNode module形式・Next.js partialPrefetching警告は残る。最新CI/統合は本branchのPR Checksへ記録する。
- 外部テンプレートへの戻り先追加、公開された修正の招待復帰、スマホのパスワード再設定、地図、PWAインストールと写真付き一連操作は未確認。パスワード再設定メールのTokenHash方式への変更もまだ案内/保存していない。

## 参照資料

- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Vercel domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Go template URL query escaping](https://pkg.go.dev/text/template#hdr-Functions)
