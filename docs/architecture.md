# 構成と責務

初回調査日：2026-10-03。統合後の更新日：2026-10-05。
P1ローカルモックは起動・操作確認済み。2026-10-17のAUTH-03で認証画面・遷移を整備した。実Auth・業務APIの動作は未確認。
機能の目標は[要件](kokoiko-requirements.md)、採用判断は[decisions](decisions.md)を参照。

## 現在の構成

Next.js App Router、TypeScript、Tailwind CSS、Supabaseのスターターが実在する。
版・環境・パッケージ管理は[verification](verification.md)へ集約する。

| パス | 現在の責務・事実 |
|---|---|
| [app/app/](../app/app/) | P1モックのホーム、候補、計画、思い出と共通枠 |
| [app/layout.tsx](../app/layout.tsx) | フォント、ここいこのメタデータ、ThemeProvider |
| [app/globals.css](../app/globals.css) | Tailwindと明暗テーマ用CSS変数 |
| [app/protected/page.tsx](../app/protected/page.tsx) | `/protected`。claims確認・未認証時リダイレクト・利用者情報の表示 |
| [app/protected/layout.tsx](../app/protected/layout.tsx) | スターター用ヘッダー・フッター |
| [app/auth/](../app/auth/) | login、sign-up、sign-up-success、forgot-password、update-password、error。confirmはRoute Handler |
| [components/](../components/) | 認証フォーム、テーマ切替、スターター案内・tutorial、共通UI |
| [lib/supabase/client.ts](../lib/supabase/client.ts) | 公開用環境変数を使うBrowserクライアント |
| [lib/supabase/server.ts](../lib/supabase/server.ts) | リクエストごとに生成するServerクライアント、Cookie連携 |
| [lib/supabase/proxy.ts](../lib/supabase/proxy.ts) | セッション確認・Cookie更新、未認証の対象ルートをログインへ誘導 |
| [proxy.ts](../proxy.ts) | 上記処理とmatcher。画像拡張子等は対象外 |
| [lib/utils.ts](../lib/utils.ts) | `cn()`とSupabase環境変数の存在判定 |
| [lib/kokoiko/](../lib/kokoiko/) | P1の型・グループ境界を持つローカル保存処理 |
| [next.config.ts](../next.config.ts) | `cacheComponents: true`。`/`からP1ホーム`/app`へ一時転送 |

業務API、`types/`、`lib/maps/`、`supabase/migrations/`は現状ではない。
地図ライブラリ、実DBの業務データアクセス層、アップロード処理も見つかっていない。

## コード上のデータの流れ

P1では`app/app/`のClient Componentが`lib/kokoiko/mock-repository.ts`を呼び、
候補・反応・計画・訪問・思い出を同じブラウザの`localStorage`へ保存する。
グループ名は固定デモ表示で、実ユーザーとの共有はない。
以下は別に残るSupabaseスターターのAuth処理。

1. Browserの認証フォームが`lib/supabase/client.ts`を通してSupabase Authを呼ぶ。
2. ログイン成功時は`/app`または元のアプリ画面へ移動する。登録・再設定もAuthを呼ぶ。
3. `proxy.ts`から`updateSession()`を呼び、Cookieを読み書きして`getClaims()`で確認する。
4. Server側のAuth表示とprotectedページも`getClaims()`を呼ぶ。
5. [callback](../app/auth/callback/route.ts)がPKCEコードをセッションに交換する。token hash方式の[メール確認](../app/auth/confirm/route.ts)は`verifyOtp()`を呼ぶ。

これは実APIを呼ぶコードで、動作成功の証拠ではない。メールテンプレート、redirect設定、
接続先、外部Auth設定は未確認。環境変数未設定時はproxyの確認をスキップする。
protectedページ自身の確認は別にある。グループ所属の確認はどちらにもない。
開発用Supabaseはユーザー回答で未作成。[設定手順](auth-setup.md)の実施と実メールの検証は後続。

[fetch-data-steps.tsx](../components/tutorial/fetch-data-steps.tsx)の`notes` SQL・取得例・RLSは
画面へ表示する文字列であり、実行する業務処理ではない。チャット追加の案内も機能ではない。
DB・Storage・グループ分離の現状と案は[data-model](data-model.md)を参照。

## 再利用する基盤

- App RouterのルーティングとServer／Clientの区別を維持する。
- Supabaseクライアントは用途に応じて既存のBrowser／Server版を使う。
  リクエストをまたいでServerクライアントをグローバル共有しない。
- proxyのクライアント生成とclaims確認の順序、Cookieを保持したレスポンスを尊重する。
  認証変更時は関係するコメントとコードを再調査する。
- 共通UIと`cn()`を再利用する。一覧は[frontend](frontend.md)にまとめる。

## 将来の設計案と採用の境界

以下は旧architectureと要件§6・§8を引き継ぐ設計案であり、作成済み構成ではない。

- 業務の画面・部品・データアクセスを責務ごとに分ける。具体的なルート・ファイル名はUI-01で提案する。
- URLで扱える検索・絞り込みはURL、一時UI状態はReact state、保存内容は永続層へ分ける。
- 無秩序なDBアクセスの分散を避け、必要なデータ関数を`lib/`へ整理する。
- グループ、リスト、候補、反応、コメントから小さく実データ化する。
- 予定・訪問・思い出をつなぐ。DBとStorageのアクセス制御を合わせて設計する。
- 大規模な状態管理依存は必要性が明確になるまで追加しない。
- 地図・Places・位置情報・通知は範囲と費用を決めた個別タスクで扱う。
- Vercelは旧資料の候補。配備済み・採用確定とは扱わない。

P0〜P5は要件書の段階案。[TASKS](../TASKS.md)は小タスクの候補で、一括実装の許可ではない。
旧資料と地図の導入順などの差異は[development-flow](development-flow.md)に記録する。
