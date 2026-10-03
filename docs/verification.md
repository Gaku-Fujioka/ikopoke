# 検証・実行環境

確認日：2026-10-03。コマンドの存在、実行、成功を別々に記録する。
今回の文書整備ではアプリ起動・lint・型検査・テスト・buildを実行しない。

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

Nextとeslint-config-nextの版が異なる。互換性やlint成功は未確認（VERIFY-01）。
NextとSupabaseのpackage指定は`latest`。固定・更新方針は別タスクで判断する。

## 現行コマンド

以下の4件がpackage.jsonの実在スクリプト。今回の実行結果はいずれも「未実行」。

| コマンド | 実体・用途 | 前提 | 存在 | 今回の実行／成功 |
|---|---|---|---|---|
| `npm run dev` | `next dev`：開発サーバー | 依存導入、利用可能なポート | 確認済み | 未実行／未確認 |
| `npm run lint` | `eslint .`：lint | 依存・ESLint設定 | 確認済み | 未実行／未確認 |
| `npm run build` | `next build`：build | 依存、対象環境、必要な接続・ネットワーク | 確認済み | 未実行／未確認 |
| `npm run start` | `next start`：productionサーバー | 成功したbuild | 確認済み | 未実行／未確認 |

新規checkoutで依存導入が必要なら、lockfileを確認して`npm ci`を使う手順とする。
これはnpmの依存導入コマンドでpackage scriptではない。今回未実行。
既存node_modulesを勝手に入れ直さず、依存変更を別タスクへ分ける。

型検査は[tsconfig.json](../tsconfig.json)にstrict・noEmit設定があり、TypeScript依存もある。
`typecheck`スクリプト・標準実行手順は未整備。`test`・`check`スクリプト、
テストファイル・runner・設定もない。VERIFY-02／VERIFY-03で整理するまで
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
Supabase未設定時はトップに設定案内を出しproxy確認をスキップするコードがある。
認証動作の確認には専用の開発接続先、Authメール・redirect設定、試用アカウントが必要。
旧環境テンプレートのGoogleキー名は現行コードでは未使用。今は設定不要。

## 変更種類ごとの検証

| 変更 | 必要な確認 | 現状の不足 |
|---|---|---|
| 文書のみ | 相互リンク・パス・要件ID・コマンド根拠・提案と決定・自己レビュー・差分 | 文書用lintやリンク検査の標準スクリプトなし。手動／一時的な読み取り検査で結果を記録 |
| UI・ルート | lint、利用可能な型検査、関連検証、ブラウザ操作。buildは影響に応じて | 型検査・テスト手順未整備。実行できない項目は理由を記録 |
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

作業ツリーと追跡ファイルにGitHub Actions workflowはない。
旧PRテンプレートはCIの実装ではない。CI-01で最小CIを設計し、別の許可されたタスクで実装する。
その際は実際のローカルコマンドと同じ検証を使い、環境前提を揃える。
CI未整備を成功と扱わず、導入後は対象commitの結果を確認し、失敗時はマージしない。

結果は[タスクテンプレート](tasks/TEMPLATE.md)に記録する。
各項目に「存在確認／実行済み・未実行／成功・失敗・未確認」と理由を付ける。
ブラウザ、外部DB、別レビュー、CIの結果は個別に残す。
