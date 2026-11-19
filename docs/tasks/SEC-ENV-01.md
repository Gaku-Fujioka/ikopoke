# SEC-ENV-01：セキュリティ更新と検証環境の統一

作成日：2026-11-19。状態：ローカル検証・自己レビュー済み。CI確認待ち。優先A。担当：本Agent単独。
branch `fix/security-development-env`、基準main `12e89e023af9893ce3b599be6a37ce2387c4d087`。
対象：N-05/09/10/11、D-039。先行：DEPLOY-01、PERF-02。

## Goal・採用範囲

ユーザーの「セキュリティ更新と開発環境の整備進めて」に対応する。
2026-11-19のnpm auditでcritical 1/high 3/moderate 7を検出。npm lockのNext 16.3.4と既存pnpm環境の16.4.2が異なり、PGlite不足でDBテストを実行できなかった。

- Nextと対応するESLint設定を16.4.6へ更新し、必要な間接依存の修正版を解決する。Supabaseは既存の0.12.6/2.115.0を固定し、Auth/DB仕様は変更しない。
- npmとpackage-lock.jsonを正本にする。Node 22.23.5/npm 10.9.9をローカルとCIで使用し、Node 22/npm 10の条件違いをinstall時に検出する。
- lint、型検査（アプリと既存Edge Function）、既存全テスト、監査をnpm scriptsへまとめる。DBテストの同時実行数を2へ制限し、CIも同じ入口を使用する。
- 別worktreeでnpm ciを実行し、既存のpnpm node_modulesとdirty変更を保全する。

## 対象外・変更対象

新機能、UI再設計、DB/migration/外部設定、データ初期化、手動本番deploy、既存READMEの変更・旧資料32削除・未追跡.claude/pnpm/workは対象外。
変更対象：package.json/lock、eslint.config.mjs、.nvmrc、.npmrc、CI、AGENTS、TASKS、verification、decisions、本書。既存テストの変更が必要なら理由を記録する。

## Done・Verification

- npm ciでlockと実体が揃い、PGliteを含む既存全テスト、lint、型検査、本番buildが成功する。
- npm auditで検出項目を確認し、残件があれば内容と理由を記録する。依存を一括で最新版へ更新せず、修正版を必要な範囲で解決する。
- 自己レビュー、最新CI、PR/main統合を区別して記録する。D-009で独立レビューを待ち条件にしない。
- 実メール/実アカウント/実DB操作とスマホ操作の確認は今回の自動検証に含めない。

## 結果

- npm lock監査は11件（critical 1/high 3/moderate 7）から0件へ。Next/ESLintに加えて、残ったbrace-expansion・postcss-selector-parser・source-map-jsだけを既存の互換範囲で更新した。
- eslint-config-next 16で新たに導入されたReact Compiler関連の2診断が、既存23ファイルの179箇所（error-boundaries 169/set-state-in-effect 10）を報告した。React Compilerは未導入。今回の環境更新でUI/保存/画像/招待を一括改修せず、この2種類だけ警告として可視化する。既存rules-of-hooks/exhaustive-deps、Next/TypeScriptのルールは従来のエラー設定を維持する。警告解消を完了条件にすり替えない。
- 導入と更新の処理を一度重ねたため停止し、lockfile確定後のnpm ciを順番に再実行して成功した。検証は再導入した依存に対して行う。
- 既存変更は元worktreeに保持し、この差分へ含めない。CI/統合の最新結果は本タスクのPRへ記録する。

- npm ci（Node 22.23.5/npm 10.9.9）成功。既存60テストファイル・全412件成功、アプリと既存Edge Functionの型検査成功。lintはエラー0、上記の新規診断179警告。npm run auditは全依存で0件。

- npm run buildはNext 16.4.6で最後まで成功し、更新前のSecurityFatalErrorは解消。既存のpartialPrefetching案内とNodeのMODULE_TYPELESS_PACKAGE_JSON警告は残る。
- 自己レビュー：固定対象は本branchのcommitと本書の変更対象11ファイル。依存差分、全60テストの自動列挙、Node/npmの版、CIの共通入口、型検査のEdge Function維持、元worktreeのdirty差分除外を確認。独立レビューはD-009に従い未実施。ソース/テスト本体/認証/DB/Storageの変更なし。
- 参照：[Next.jsのセキュリティ更新](https://nextjs.org/blog/nextjs-security-update-october-14-2026)、[Next.js ESLintのflat config](https://nextjs.org/docs/app/api-reference/config/eslint)、[Node公式配布](https://nodejs.org/dist/v22.23.5/)、[Supabase npmセキュリティ](https://supabase.com/docs/guides/security/npm-security)。Supabase changelogの関連変更を確認し、今回はクライアントを既存版に固定するだけでAPI変更はない。
