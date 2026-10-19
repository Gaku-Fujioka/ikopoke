# 構成と責務

2026-10-19追記：FINANCE-01はmain統合許可済み。下記の試用時点の未マージ表記は当時の記録で、統合状況は[PR #35](https://github.com/Gaku-Fujioka/kokoiko/pull/35)、最新指示は[FINANCE-01](tasks/FINANCE-01.md)を参照する。

FINANCE-01（2026-10-18、試用branch）：`lib/finance/`が入力検証・本人用RPC取得と型への射影、`app/app/finance/`がサーバー画面/Action、`components/finance/`が集計表示と入力フォームを担当。共有データと会計の寿命を分離し、本人用スナップショットへ保存する。公開RPCはSECURITY INVOKER、非公開処理で本人/状態/改訂を検証。開発DB適用・ローカル自動検証済み、実ユーザー操作は未確認、main未マージ。[詳細](tasks/FINANCE-01.md)。

初回調査日：2026-10-03。統合後の更新日：2026-10-05。
P1ローカルモックは起動・操作確認済み。2026-10-17のAUTH-03で認証画面・遷移を整備し、AUTH-04の基本正常系はユーザー確認済み。
GROUP-02はmain統合済みで、実DB適用と実ユーザーの作成・再読込後の保持はユーザー確認済み。GROUP-03もmain統合済み、接続先チャットでの実DB適用成功をユーザーが報告し、招待参加の実操作は確認待ち。ITEM-02は実DB適用と実アカウントでの保存・再読込をユーザー確認済み。予定・思い出と既存P1画面はモックのまま。
機能の目標は[要件](kokoiko-requirements.md)、採用判断は[decisions](decisions.md)を参照。

## 現在の構成

UI-APP-01で`/app`と全グループの4タブ一覧を実データ化した。`components/home/`はServer Componentで所属/共有データを取得し、共通ナビの＋と更新操作だけClientにする。グループホームは同じ構成を再利用し、設定を独立ルートへ移した。`lib/home/`は集約取得・安全なUI型への射影・URL/色の共通規則・保存後の限定した再取得を担当する。近況RPCは所属を検証して現在の各記録をまとめ、監査履歴は複製保存しない。地図APIは未接続。以下のP1や古い未実装表記は当時の記録として残す。

REACTION-02で`lib/items/reactions.ts`・反応Actionとフォームを追加し、候補詳細から実データの反応を扱う。集計は所属を検証するRPCで行い、ブラウザに他メンバーの識別子を渡さない。実適用version `20261017153040`と実アカウントでの保存・再読込・変更・取消はユーザー確認済み。別アカウントは未確認。

ITEM-02で`lib/items/`に候補の検証・Supabaseアクセス、`app/app/groups/[groupId]/items/`に実データ用のServer Componentと保存Action、`components/items/`に入力操作だけのClient Componentを追加した。
グループ内の候補作成・閲覧のmigrationはローカル検証済み、ユーザーから実適用version `20261017112451`と実アカウントでの候補追加・再読込後の保持の成功報告を受領。別アカウントの共有は未確認。以下のP1モックと並行して段階的に導入する。

Next.js App Router、TypeScript、Tailwind CSS、Supabaseのスターターが実在する。
版・環境・パッケージ管理は[verification](verification.md)へ集約する。

| パス | 現在の責務・事実 |
|---|---|
| [app/app/](../app/app/) | P1モックのホーム、候補、計画、思い出と共通枠 |
| [app/app/groups/](../app/app/groups/) | 実グループの一覧・作成・詳細。招待入口と発行・確認・参加・無効化のServer Action |
| [lib/groups/](../lib/groups/) | 実グループの入力検証とSupabaseアクセス。所属による分離はDBのRLSが担当 |
| [supabase/migrations/](../supabase/migrations/) | グループ・所属と招待のmigration。両方の実適用成功がユーザー報告済み。ローカルのversionを実履歴に合わせる |
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

独立した業務API、`types/`、`lib/maps/`は現状ではない。
グループ以外の実DBアクセス、地図ライブラリ、アップロード処理は未実装。

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

上記コードの存在だけでは動作成功の証拠にならない。AUTH-04ではユーザーがメール確認・再ログイン・再読込・再設定後の再ログインを確認した。
異常系と複数ユーザーの業務共有は未確認。環境変数未設定時はproxyの確認をスキップする。
protectedページ自身の確認は別にある。グループ所属の確認はどちらにもない。
開発用Supabaseはユーザーが作成・設定済み。Agentは設定値を表示せず、Auth公開設定の接続成功を確認した。実DBの管理接続とスキーマ調査は後続。

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
