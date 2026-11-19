# ここいこ：開発の案内

少人数で候補を共有し、反応・おでかけ計画・訪問記録・思い出へつなげるアプリ。
地図・カレンダー・記念日は、この中心フローを支える。

## 読む順序

この案内 → 今回関係するdocs → 関連コードの順に読む。毎回全docsを読む必要はない。
初回参加・仕様全体の変更では[要件定義書](docs/kokoiko-requirements.md)全体を読む。
通常は対象のF／N／Q IDと関係する節を読み、[タスク管理](TASKS.md)で範囲・依存を確認する。
要件書はレビュー用ドラフト。既存仕様・提案・要確認・後回しを区別する。
受入条件案やQの回答は、文書を読むだけでは採用済みにならない。

| 作業 | 読む資料 | コードへの入口 |
|---|---|---|
| 構成・責務・技術選定 | [architecture](docs/architecture.md) | `app/`、`lib/` |
| 画面・導線・共通UI | [frontend](docs/frontend.md)、対象F・N | `app/`、`components/` |
| 認証・保存・DB・画像 | [data-model](docs/data-model.md)、対象F・N | `lib/supabase/`、`app/auth/` |
| 検証・環境・コマンド | [verification](docs/verification.md) | `package.json`、検証設定 |
| 進め方・Git・並列・引継ぎ | [development-flow](docs/development-flow.md) | 今回の差分 |
| 判断・未決定事項 | [decisions](docs/decisions.md)、対象Q | 判断対象のコード |
| タスク定義 | [TASKS](TASKS.md)、[テンプレート](docs/tasks/TEMPLATE.md) | 変更対象のファイル |

長い手順の参照元は[再現性の高いAI駆動開発手順](docs/codex_reproducible_ai_development_workflow.md)。
プロジェクト固有の運用はdevelopment-flowにまとめる。

## 作業開始と範囲

- 作業場所・Gitルート・branch・`git status`を確認し、既存変更と自分の差分を区別する。
- 他の人やAIの変更を削除・巻き戻し・一括ステージしない。同じファイルは担当を調整する。
- 要件ID、対象外、変更予定ファイル、完了条件、検証方法を決め、関連コードを先に読む。
- 既存の設計・命名と共通部品を尊重し、1タスクを小さくする。
- 無関係な変更、一括整形、依存の大量追加、プロジェクト再作成は行わない。
- 必要な追加変更は理由と範囲を説明する。実装方針の確認と既存の作業許可を尊重する。
- 未確定仕様・権限・重大な設計を独断で決めない。小さい仮定も仮定として記録する。
- 提案の採用はdecisionsへ残す。承認を避けるために既存指示を削除・弱めない。

## 実装の共通ルール

- Next.js App Router・TypeScript・Tailwind・Supabaseの既存構成を再利用する。
- Server Componentを基本とし、ブラウザ状態や操作が必要な箇所だけClient Componentにする。
- UIはモバイルを先に確認する。主要CTA・余白・カード階層・ナビを揃える。
- 操作性・保守性・アクセシビリティを優先し、画像なしでも成立させる。
- モックは明示する。画像・仮データ・Auth呼出しコードだけで実機能の完成と報告しない。
- DB変更はmigrationに残す。ユーザーデータはRLS、画像はStorageの制御を前提にする。
- 他グループの直接取得・更新も防ぐ。画面の非表示だけでアクセス制御を済ませない。
- 本番相当データをSQLへ直書きしない。本番適用とローカル変更は分ける。
- 秘密鍵・認証情報・環境変数の値をコード、Client、ログ、報告へ出さない。
- 環境変数は名前と用途だけ扱う。`.env.local`、APIキー、トークンをcommitしない。
- 外部APIはUIモック確認後、地図表示・検索・詳細・写真を分けて導入する。
- 料金・保存条件・帰属表示・キー制限は導入時に現行の公式資料で確認する。

## 検証とレビュー

- 存在・用途を確認した主要スクリプト：`npm run dev`、`npm run lint`、`npm run build`。
- コマンドの前提・変更別の検証は[verification](docs/verification.md)を読む。
- `npm run typecheck`・`npm test`・`npm run check`・`npm run audit`を整備済み。Node/npmは`.nvmrc`とpackage.json、依存はnpm/package-lock.jsonを正本とする。
- 実装後は利用可能なlint・型検査・関連テスト・buildを変更に応じて行う。
- 文書のみではリンク・根拠・差分を確認する。不要なbuildやテスト新設はしない。
- バグは再現 → 必要な回帰検証 → 修正 → 再確認。繰返すミスは自動検出を検討する。
- 差分を自己レビューし、別AIまたは人間のレビューへ渡す。レビュアーは差分を固定して読む。
- 結果には変更・検証の実行／成功／失敗／未実行・理由・モック・未解決事項を記載する。
- ローカル確認とCIを区別する。CI未整備・未実行を成功と報告しない。

## Git・担当

- `main`を直接大規模変更しない。機能・修正ごとにbranch、commitは意味のある小単位にする。
- Git変更・公開操作は依頼範囲に従う。検証とレビューが成功した変更は[D-004](docs/decisions.md)に従いAgentが`main`へマージできる。CI失敗時はマージせず原因を修正し、未実行なら明記する。
- 共通文書は1つのAgentが担当する。実装の並列化はbranch・worktree・担当を分ける。
- タブだけでは分離にならない。同一ディレクトリで複数Agentがbranchを切り替えない。
- Agentの自動指示は設定・能力・許可を確認する。文書整備だけで他Agentを起動しない。
- 引継ぎ項目と共有ファイルの担当ルールはdevelopment-flowを参照する。

旧スターター資料の所在・差異・保全方針はdevelopment-flowの「旧資料との関係」に記録する。
