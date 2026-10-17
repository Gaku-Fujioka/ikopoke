# 検証・実行環境

更新日：2026-10-05。コマンドの存在、実行、成功を別々に記録する。
以下の「初期文書整備」は2026-10-03時点の記録。統合後の確認結果は次節に記す。

## REACTION-02の検証（2026-10-18）

- 既存90件に反応DB12件・Action7件・取得3件を加え、112件のNodeテスト成功。DBはPGliteの既存一時モジュールを使い、ローカルnode_modulesや依存を入れ直さない。
- DBで匿名・非所属・本人IDなしの拒否、候補とグループの不一致、他者の生データ非公開、変更・取消・再送による件数、1,000件超の集計、所属を外した後の拒否を検証。
- Actionで入力・認証・他者IDの無視・取消の明示、成功時だけの再取得と失敗時の情報保護を確認。取得処理は不正な集計・空応答を0件として扱わず、想定外の識別子をClientへ渡さない。
- lint・型検査・build成功。自己レビュー・GitHub CIは[REACTION-02](tasks/REACTION-02.md)に記録する。
- Browser/アプリのサーフェス一覧は空。モバイル幅・キーボード・クリック・実アカウントでの保存は未確認。外部DB未適用。同時接続の並行試験はPGliteでは未実施で、SQLの行ロックと複合PKを確認する。
- 保存後の再取得には[Next.jsのrevalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)を使う。実サービスの操作確認はDB適用後に行う。

## ITEM-02のローカル確認（2026-10-17・既存の記録）

- `npm run lint`、`npx tsc --noEmit`、`npm run build`が成功。ローカルNextは既存pnpm環境の16.4.2、CIはnpm lockfileを使う。依存は入れ直していない。
- CIに列挙したNodeテスト90件が成功（既存67件＋候補DB11件・Action/入力8件・取得3件・Auth proxy1件）。PGliteは既存の一時ディレクトリのモジュールを環境変数で指定した。
- PostgreSQLで招待後の候補共有、非所属／匿名の直接取得・作成拒否、直接書き込み拒否、入力境界・再送・なりすまし・所属を外した後の再送拒否を検証。
- 別々の所属グループの候補を混ぜない取得とページ送り、Actionの失敗時の情報保護・入力前検証・成功時だけの遷移を検証。JWT自体の検証はPGliteでは再現しない。
- Computer Useの利用可能なブラウザ／アプリは空で、Agentによる実ブラウザの幅・キーボード・入力保持の確認は未実施。ユーザーは実アカウントで候補追加・詳細再読込・一覧復帰後も名前とメモが残ることを確認した。別アカウントの共有は未実施。
- ユーザーが`create_items`の実適用version `20261017112451`と構造・RLS・権限・履歴の確認成功を報告した。本Agentの直接照合とは区別し、ローカルのmigration名とテストの参照先を同期する。SQL本文は変更せず、外部DBの再適用・履歴書換えはしない。
- 改名後のSQLによるDBテスト11件成功。実開発プロジェクトへの匿名RESTの候補SELECT（取得件数0）と全引数nullの作成RPCは、2件ともHTTP401・`42501`で拒否された。設定値やユーザーデータは表示せず、定義・履歴の直接照合と実JWTでの保存確認は未実施。
- GitHub CI・統合状態は[ITEM-02](tasks/ITEM-02.md)に記録する。Nextの既存partialPrefetching警告とNodeのmodule形式警告は残る。

## AUTH-04とGROUP-02の確認（2026-10-17・既存の記録）

ユーザーが開発用Supabaseの作成・ローカル設定・リダイレクト設定を実施し、登録・メール確認、ログアウト・再ログイン・再読込、再設定後の新パスワードでのログイン成功を報告した。
Agentは値を表示せず公開Auth設定HTTP200（メール方式有効・登録有効・メール確認あり）と、未認証のアプリURLから検索条件を保持したログイン誘導をHTTPで確認。
誤パスワード・期限切れ・セッション期限・複数アカウントは実サービスで未確認。

GROUP-02はlint・型検査・34件のNodeテスト・buildを実施し、結果を[個別タスク](tasks/GROUP-02.md)に記録する。
全テストのコマンド：`node --experimental-strip-types --test tests/auth-redirect.test.mjs tests/auth-handlers.test.mjs tests/mock-repository.test.mjs tests/group-actions.test.mjs tests/group-database.test.mjs`。
DBテストはPGliteのPostgreSQLでmigrationとRLSを実行する。実Supabaseのschema・migration・REST権限の検証とは分ける。
既存node_modules保護のため、ローカルのPGliteは一時ディレクトリを`KOKOIKO_PGLITE_MODULE_URL`で指定。CIはnpm lockfileのdevDependencyを使う。
実DBについては、ユーザーが別の接続先チャットで実行した調査・適用結果を報告した。`create_groups`のversion `20261017091513`と定義・RLS・権限・履歴の確認成功を報告済み。
初回は貼り付け由来の装飾で失敗し、許可された装飾のみを直して成功したとの報告。ローカルSQL本文は変更せず、実versionに改名してテストの参照先も更新する。
本Agentは実DBの構造・履歴を直接照合していない。別途、同じ開発プロジェクトへ匿名RESTで両テーブルSELECT（取得件数0）とRPC（両入力null）を要求し、3件ともHTTP401・`42501`で拒否されることを確認した。設定値・ユーザーデータは表示せず、保存可能な入力は送っていない。
ユーザーが実ログインでグループ作成・再読込・一覧復帰後の保持を確認済み。Agentの接続ブラウザは空で、実JWTによる所属別RESTと複数利用者の分離は未確認。

## GROUP-03の確認（2026-10-17）

ローカルでlint・型検査・62件のNodeテスト・build成功。追加したDBテスト13件とServer Actionテスト11件、認証proxyテスト3件、認証復帰の追加1件を含む。
CIは既存5ファイルに`tests/auth-proxy.test.mjs`・`tests/group-invitations-database.test.mjs`・`tests/group-invitation-actions.test.mjs`を加える。PGliteのローカル指定方法は前節と同じ。
HTTPで4件成功：未ログインの招待入口200、グループ一覧307、登録とメール確認待ち画面の招待復帰リンク保持。
ユーザーが接続先チャットでの`create_group_invites`適用成功（version `20261017094719`）と定義・RLS・列権限・4関数本体・履歴の確認成功を報告した。本Agentによる構造・履歴の直接照合とは分ける。
本Agentは同じ開発プロジェクトで匿名RESTの招待テーブルSELECT（取得件数0）と4関数（全引数null）の実行を確認し、5件ともHTTP401・`42501`で拒否された。設定値やユーザーデータは表示せず、保存や更新ができる入力は送っていない。
SQL本文は維持して実適用versionへファイル名を同期し、テストの参照先も更新する。実アカウントでの招待参加・無効化・新規登録からの復帰とコピー・モバイル操作は未確認。Cuaの接続ブラウザ一覧は空だった。
初回lintで未使用importを検出して削除し、再実行は成功。既存のNodeモジュール形式警告・Next partialPrefetching案内は残る。

## AUTH-05の確認（2026-10-17）

招待先の新規登録で一律エラーを再現し、ユーザーが接続先チャットのAuthログで確認メール送信上限（`over_email_send_rate_limit`・HTTP429）を確認した。
エラー変換を固定の日本語に限定し、追加5件のNodeテストで既知コード・未知の失敗・provider文面や認証情報の非表示を確認。全67件・lint・型検査・build成功。
CIに`tests/sign-up-error.test.mjs`を追加。Agentの公開Auth設定確認はHTTP200、メール登録有効・登録停止なし・メール確認ありだった。SMTP設定詳細と回復時刻は未確認。
今回アカウント作成・確認メール送信・Auth設定変更は行っていない。実ユーザーの再試行と招待参加は後続。

## AUTH-03の確認（2026-10-17）

`feat/auth-app-entry`で認証導線の実装を検証する。開発用Supabaseはユーザー回答で未作成。
実メール・実Auth・複数ユーザー・業務DBの動作は未確認で、[設定手順](auth-setup.md)の後にAUTH-04で確認する。

- Nodeテストは次の3ファイル。計19件成功。`auth-handlers`はRoute Handler本体を実行し、SupabaseとNextのredirectだけを試験用に置き換える。外部接続成功の証拠ではない。
  `node --experimental-strip-types --test tests/auth-redirect.test.mjs tests/auth-handlers.test.mjs tests/mock-repository.test.mjs`
- lint、型検査、buildは実施して結果を個別タスクへ記録する。
- ローカルproductionサーバーへのHTTP確認は9件成功：未設定時の4フォーム（日本語・送信不可）、callback/confirmの3リクエスト、固定のエラー表示、デモホーム。
- ブラウザ操作は未実施。利用可能なブラウザ一覧が空のため、360/390/1280px・フォーカス・実クリックの確認は後続へ残す。HTTP確認をブラウザ検証と扱わない。
- 最初のsandbox内lint/型検査は既存node_modulesの読み取り権限で失敗し、権限付きで再実行した。
  型検査で古い`.next/types`が削除済み`app/page`を参照していたため、buildで生成し直した後の型検査は成功した。
- 現在のnode_modulesはNext 16.4.2で、下の2026-10-05のlockfile調査値と異なる。今回依存やlockfileは変更せず、CIでは`npm ci`による検証を別に確認する。
- CIに`auth-handlers.test.mjs`を追加した。実装commit `5b2af74`の[GitHub CI](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39015073943)で`npm ci`・lint・型検査・19件のテスト・buildがすべて成功。
  [Draft PR #1](https://github.com/Gaku-Fujioka/kokoiko/pull/1)は人間レビュー・ブラウザ検証待ちで、mainへ未マージ。

## 統合後の確認とCI

`integration/kokoiko-mvp`の`3aa6c84`で`npm run lint`、`npx tsc --noEmit`、
`node --experimental-strip-types --test tests/auth-redirect.test.mjs tests/mock-repository.test.mjs`
（7件）、`npm run build`が成功した。buildはGoogle Fonts取得のためネットワークが使える環境で再実行した。
Edgeのヘッドレス操作では360／390／1280px、4入口ナビの配置と横はみ出し、候補追加から思い出まで、
再読込後の保持、検索条件の復帰、検索0件、欠落ID、スキップリンクへのTab移動を確認した。
実Auth／業務API／複数利用者の動作は確認していない。

`.github/workflows/ci.yml`はPRと`main`へのpushでNode 22.19.0を使い、`npm ci`、lint、型検査、
上記7件のテスト、buildを順に実行する。GitHub上のCI結果はworkflowをpushするまで未実行。

## 実行環境と前提

- 作業環境はWindows／PowerShell。前回確認値：Node 22.19.0、npm 10.9.3。
- [package.json](../package.json)に`packageManager`・`engines`指定なし。
  `.nvmrc`・`.node-version`なし。Nodeのプロジェクト固定は未決定。
- [package-lock.json](../package-lock.json)が存在（lockfileVersion 3）。現行手順はnpmで記載する。
  原本のpnpm例を理由にパッケージ管理を移行しない。
- lockfileのNext 16.3.4はNode 20.9以上、Supabase JS 2.115.0は22以上を要求。
  これは依存の制約であり、新たに採用したNode固定ではない。

| lockfile上の依存 | 記録された版 |
|---|---|
| Next / React / React DOM | 16.3.4 / 19.2.8 / 19.2.8 |
| TypeScript / Tailwind CSS | 5.9.3 / 3.4.19 |
| Supabase SSR / Supabase JS | 0.12.6 / 2.115.0 |
| ESLint / eslint-config-next | 9.39.5 / 15.3.1 |

Nextとeslint-config-nextの版が異なる。統合後のlintは成功したが、版の整合方針は未決定。
NextとSupabaseのpackage指定は`latest`。固定・更新方針は別タスクで判断する。

## 現行コマンド

以下の4件がpackage.jsonの実在スクリプト。実行結果は2026-10-05の確認分。

| コマンド | 実体・用途 | 前提 | 存在 | 統合後の実行結果 |
|---|---|---|---|---|
| `npm run dev` | `next dev`：開発サーバー | 依存導入、利用可能なポート | 確認済み | 今回未実行 |
| `npm run lint` | `eslint .`：lint | 依存・ESLint設定 | 確認済み | 成功 |
| `npm run build` | `next build`：build | 依存、対象環境、Google Fontsへの接続 | 確認済み | 成功。接続不可の環境ではフォント取得失敗 |
| `npm run start` | `next start`：productionサーバー | 成功したbuild | 確認済み | 起動・HTTP応答を確認 |

新規checkoutで依存導入が必要なら、lockfileを確認して`npm ci`を使う手順とする。
これはnpmの依存導入コマンドでpackage scriptではない。今回未実行。
既存node_modulesを勝手に入れ直さず、依存変更を別タスクへ分ける。

型検査は[tsconfig.json](../tsconfig.json)にstrict・noEmit設定があり、TypeScript依存もある。
`typecheck`・`test`・`check`のnpmスクリプトはない。型検査は`npx tsc --noEmit`、
回帰テストはNode組み込みrunnerで`tests/*.test.mjs`を実行する。
架空のnpmスクリプトを実行例や成功条件として置かない。

## 起動と接続

既存リポジトリでの入口は[README](../README.md#ここいこの開発)。新規アプリを作り直さない。
`.env.example`を参照し、未作成の場合にローカル用`.env.local`を用意する。
既存の環境ファイルは上書きせず、値はログ・スクリーンショット・報告へ出さない。

| 環境変数名 | 必要性・用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Authクライアントの接続先。認証動作に必要 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Browser／Serverクライアント用公開キー。認証動作に必要 |
| VERCEL_URL | metadataのURLと配備案内。ローカルはコード上のfallbackあり |
| VERCEL_ENV / VERCEL_PROJECT_PRODUCTION_URL | 配備時のチュートリアル案内用 |

現行作業ツリーには`.env.example`のみ見つかった。外部注入・配備設定は不明。
Supabase未設定時はproxyの認証確認をスキップし、`/`から`/app`のP1モックへ進む。
スターターの設定案内部品はコードに残るが、トップ画面には表示しない。
認証動作の確認には専用の開発接続先、Authメール・redirect設定、試用アカウントが必要。
旧環境テンプレートのGoogleキー名は現行コードでは未使用。今は設定不要。

## 変更種類ごとの検証

| 変更 | 必要な確認 | 現状の不足 |
|---|---|---|
| 文書のみ | 相互リンク・パス・要件ID・コマンド根拠・提案と決定・自己レビュー・差分 | 文書用lintやリンク検査の標準スクリプトなし。手動／一時的な読み取り検査で結果を記録 |
| UI・ルート | lint、型検査、関連検証、ブラウザ操作。buildは影響に応じて | npmの型検査・テストscriptはない。上記の直接コマンドを使う |
| 認証・保存 | 上記＋正常／失敗／セッション切れ／再取得・再ログイン | 開発接続先・試用アカウント・外部設定は未確認 |
| DB・Storage | migration差分、所属別の直接取得・更新、画像取得、保全・再実行 | migration・RLS・Storage・検証環境が未整備／未確認 |
| バグ | 修正前の再現、必要な回帰検証、修正後の同じ操作 | テストrunnerがなければ再現手順を残し、必要な基盤を別途決める |
| 外部API | エラー・上限・拒否・手入力fallback、費用・キー制限 | API未接続。サービスの現行公式資料と採用判断が必要 |

文書変更だけのためにアプリ全体のテストを新設したり、不要にbuildしたりしない。
スクリプトの存在やnode_modules／.nextの存在から検証成功を推測しない。

## UI確認手順

対象タスクのDoneと採用済みの受入条件を使い、モック／実データを最初に明示する。

1. `npm run dev`を起動し、対象URL・日時・viewport・接続状態を記録する。
2. 360px・390px・PC幅で横はみ出し、下部ナビと本文・CTAの重なり、スクロールを確認する。
3. 対象画面の遷移、戻る、検索・絞り込みの保持、入力・保存・連打を確認する。
4. Loading／Empty／検索0件／Error／Success、画像なし、欠落した詳細を対象範囲で確認する。
5. キーボード、フォーカス、ラベル・操作名、色以外の状態表示を確認する。
6. 実接続タスクでは再読込・再ログイン・別アカウントの反映と、非所属の直接アクセスを確認する。
7. 写真やログに秘密情報・利用者情報を含めず、未確認の操作も列挙する。

まだ存在しない画面を確認済みとしない。必要な画面・基盤の用意も別タスクにする。

## CI・結果記録

GitHub Actionsの[CI workflow](../.github/workflows/ci.yml)を追加した。
旧PRテンプレートはCIの実装ではない。workflowの構文とローカルコマンドは確認したが、
GitHub側での実行は未確認。対象commitの結果を確認し、失敗時は原因を修正する。

結果は[タスクテンプレート](tasks/TEMPLATE.md)に記録する。
各項目に「存在確認／実行済み・未実行／成功・失敗・未確認」と理由を付ける。
ブラウザ、外部DB、別レビュー、CIの結果は個別に残す。
