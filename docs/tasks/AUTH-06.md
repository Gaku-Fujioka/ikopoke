# AUTH-06：外部メール送信とSupabase SMTP

作成日：2026-10-17、更新日：2026-10-21。状態：開発環境のSMTP設定・登録とログインの基本正常系はユーザー確認済み。招待経由・公開環境は未確認。F-01、N-04/05/07、D-011/032。本Agent単独。

## Goal・採用範囲

AUTH-05で確認した送信回数上限を受け、ユーザーが外部メール送信サービスの設定を選択した。
SupabaseのカスタムSMTPへ接続し、別アカウントの登録・確認メール受信・招待への復帰を検証する。

## 採用事項・外部設定

- 当初は独自ドメイン未所有・サービス未採用だった。2026-10-21にD-032の名称「いこポケ」とResendを採用し、設定操作はチャットで案内した。新しい設定手順書は作らない。
- ユーザーがGitHub学生特典を使い、Name.comで `ikopoke.app` を取得。注文完了画面で合計$0.00を確認。取得時の更新料金表示は$26.99、自動更新は有効だった。無料期間後の更新費用を無料として扱わない。Agentによる購入・有料申込は行っていない。
- メール送信用に `auth.ikopoke.app` をResendへ登録（Tokyo）。ユーザーがName.comに指定のDKIM TXT 1件・送信用CNAME 2件を追加し、ResendでVerifiedになったと報告。受信機能は有効化していない。任意のDMARCの追加は今回未確認。
- 開発用Supabase「ここいこ」（`gszekiwwrxlkorqfrdvd`）へユーザーがCustom SMTPを保存。案内した送信元は `noreply@auth.ikopoke.app`、送信者名は「いこポケ」。接続値はResend公式のHost `smtp.resend.com`、Port `465`、Username `resend` に従う。
- ResendのキーはSending access・送信ドメイン限定を案内し、ユーザーがSMTPのPasswordへ直接入力。キー自体はAgentが取得・表示せず、チャット・リポジトリ・アプリのClientへ移していない。実際のキー権限はAgent未確認。
- ユーザーは最終公開時に一般利用者が困らない構成を希望。Gmailの開発用SMTP案は未採用。公開用の独自ドメインと認証メール用サービスを整える方針で案内し、初期枠を無制限として扱わない。
- 送信枠、Supabase側の上限、実メール到達は別々に扱う。追加の有料プランや一般公開への許可を、この設定完了から推定しない。

## Done・検証

サービスと送信元の条件を確定し、DNS認証・SMTP接続・確認メール到着・ログインと招待復帰を確認する。
SMTP設定の変更と確認メールの送信は、ユーザー操作で実施状況を記録する。DB migrationやメール確認無効化は行わない。

## 2026-10-21の検証結果

- ユーザー報告：パスワード再設定メールが到着。その後、未登録アドレスで新規登録の確認メール受信・確認リンクからの登録完了・ログイン・ログアウト・再ログインに成功。案内した環境はPCのローカルアプリと同じシークレットウィンドウ。Agentによるブラウザ操作や受信箱の直接確認とは区別する。
- 初回の未到着：画面は「確認メールを送りました」だったが、ResendのEmailsは0件。Agentが開発プロジェクトのAuthログに `user_repeated_signup` を確認し、登録済みアドレスでの再試行の可能性を案内した。実際に入力されたアドレスは取得していないため、この試行との対応は断定しない。
- Agent確認：`.env.local` の値を表示せず、接続先が上記開発プロジェクトと一致することを確認。既存の開発サーバーを起動し、`/auth/sign-up` のHTTP 200を確認。サンドボックス内の起動は既存依存のEPERMで失敗し、許可付き再実行で起動成功。
- Agent確認：2026-10-21のResend APIキー・ドメイン認証・Supabase SMTP公式資料とSupabaseの変更履歴を確認。Authログの調査はイベント名・状態のみに限定し、メールアドレス・token・キーを取得していない。
- 未確認：招待リンクから新規登録して参加先へ復帰する操作、公開URLとスマホでのメール確認、今回の再設定リンクからのパスワード変更完了、期限切れ・無効リンク・再送間隔、実際の残り送信枠。AUTH-06全体のDone達成や公開完了とは扱わない。

## 今回の文書変更と検証範囲

- branch：`docs/ikopoke-mail-setup`。基準main：`1289eb104bb583a6ede4d6b0794a8d9d5139b90f`。
- 変更対象：本書、`TASKS.md`、`docs/decisions.md`。アプリコード・DB・環境ファイルは変更しない。README、旧スターター32件の削除、未追跡のpnpm関連ファイル・`work/`は既存変更として保全する。
- 文書の差分・採用根拠の自己レビューと、ローカル参照先53件の存在確認に成功。文書のみのためローカルのlint・型検査・自動テスト・buildは今回未実行。独立レビューは未実施。CIとmain統合の状態は、このブランチのPRを参照する。

## 根拠

- [GitHub学生特典](https://education.github.com/pack)
- [Resendのドメイン認証](https://resend.com/docs/add-a-domain)
- [ResendのAPIキー権限](https://resend.com/docs/create-an-api-key)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [ResendのSupabase連携](https://resend.com/docs/send-with-supabase-smtp)
- [Resendの料金](https://resend.com/pricing)
