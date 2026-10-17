# 開発用Supabaseとメール認証の設定

更新日：2026-10-17。対象：AUTH-03/04、F-01、D-007。
AUTH-03は接続前のコード整備。以下の設定と実メールの試験を終えるまでは、実Authの完成とは扱わない。
業務データは引き続きデモの`localStorage`であり、ログインしても他の人と共有されない。

## 最初にユーザーが行う操作

1. [Supabase Dashboard](https://supabase.com/dashboard)へログインし、ここいこの**開発専用**プロジェクトを作る。プラン・費用の画面は内容を確認して選ぶ。
   DBパスワードは自分で保管する。チャット・GitHub・スクリーンショットへ載せない。
2. プロジェクトのConnect／SettingsでProject URLとpublishable keyを確認する。
   既存の`.env.local`があれば上書きせず、なければ`.env.example`をコピーして作る。以下の2項目に値を設定する。
   - `NEXT_PUBLIC_SUPABASE_URL`：開発用プロジェクトのURL。
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Browserで使えるpublishable key。secret keyや`service_role`は使わない。
3. AuthenticationのEmailプロバイダーとメール確認を有効にする。
4. Authentication → URL Configurationでローカルの開発URLを設定する。ポート3000なら次の値。
   - Site URL：`http://localhost:3000`
   - Redirect URLs：`http://localhost:3000/auth/callback`
   - Redirect URLs：`http://localhost:3000/auth/callback?next=/auth/update-password`
   ポートを変える場合は両方を合わせる。Preview・本番URLは必要になった時点で個別に追加する。
5. Email TemplatesのConfirm signup／Reset passwordは標準の`{{ .ConfirmationURL }}`リンクを使用する。
   PKCEコードがアプリの`/auth/callback`へ届き、そこでセッションに交換される。
   すでに独自テンプレートを設定したプロジェクトでは、次節のtoken hash方式と混在させず、設定を確認する。
6. 開発サーバーを再起動し、`/auth/sign-up`を開く。自分が受信できるメールアドレスを使う。
   Supabase側の送信先制限・レート制限にかかった場合はDashboardの現在の案内を確認する。SMTPの追加設定は別に扱う。

完了後はチャットに「開発用Supabaseを作成し、ローカル設定とURL設定を済ませた」と伝えるだけでよい。キーやパスワードは不要。
アカウント作成・秘密情報の設定・確認メールの操作はユーザーが行う。外部DBへの業務migrationはこの手順に含めない。

## token hash方式を使う場合

既存の`/auth/confirm`も残す。標準のConfirmationURL方式が使用できる場合は、変更する必要はない。
専用の開発プロジェクトでtoken hash方式を選ぶ場合のリンク例：

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next=/app">メールアドレスを確認する</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">パスワードを再設定する</a>
```

Site URLがローカルの開発URLに一致していることを確認する。recoveryは必ず`/auth/update-password`へ進む。
PKCE方式の標準メールリンクは、申込み時のブラウザに保存された検証情報が必要なので、同じブラウザで開く。

## コードと仕組みを追う順番

1. [認証フォーム](../components/sign-up-form.tsx)：メールとパスワードをSupabase Authへ送る。アプリ独自のテーブルにパスワードを保存しない。
2. [callback](../app/auth/callback/route.ts)：メールのワンタイムコードを`exchangeCodeForSession()`でセッションに交換する。
   token hash方式は[confirm](../app/auth/confirm/route.ts)の`verifyOtp()`を使う。
3. [Serverクライアント](../lib/supabase/server.ts)：レスポンスのCookieにセッションを反映する。
4. [proxy](../lib/supabase/proxy.ts)：`getClaims()`でユーザーを確認し、Cookieを更新する。未認証なら元のアプリURLを`next`に入れてログインへ進む。
5. [ログイン](../components/login-form.tsx)：成功後は[遷移先の検証](../lib/auth/safe-next-path.ts)を通し、`/app`または元のアプリ画面へ戻る。
6. [ログアウト](../components/logout-button.tsx)：成功時だけログインへ戻る。
7. [再設定依頼](../components/forgot-password-form.tsx)→メール→callback→[新しいパスワード](../components/update-password-form.tsx)の順に追う。

認証は「誰か」の確認で、グループ所属による「何を読めるか」は別の制御になる。
後続タスクでDB・RLSを実装するまで、デモのグループチェックをアクセス制御として使わない。

## AUTH-04で行う実接続の確認

- 登録→確認メール→アプリ、ログアウト→ログイン。検索条件付きの詳細へ戻れること。
- 誤ったパスワード・未確認メール・期限切れリンク・通信失敗が成功表示にならないこと。
- 再設定メール→新しいパスワード→再ログイン。以前のパスワードでは入れないこと。
- セッションなしの`/auth/update-password`はログインへ進み、Cookie更新後もアプリ操作できること。
- 連打で重複要求せず、画面再読込後もセッションを引き継ぐこと。
- `/auth/login?next=https://example.com`などで外部へ転送しないこと。
- ログインしても業務データはブラウザ内デモであると表示されていること。

失敗時の確認には画面名・操作・時刻だけを共有し、メールリンクのcode/token、Cookie、キーを貼らない。

## 公式資料

2026-10-17に照合：[Password-based Auth](https://supabase.com/docs/guides/auth/passwords)、
[SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)、
[Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)。Dashboardの表示名は現在の画面で確認する。
