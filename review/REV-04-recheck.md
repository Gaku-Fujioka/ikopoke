# REV-04 修正再確認

- 基準: `eeccbd0`。対象: `7d36cfe`。前回の中指摘は解消。
- `app/app/layout.tsx` の変更はモック説明の1行。業務データAPIの未接続、保存・共有不可に範囲を限定したため、環境変数設定時に既存proxyが `/app` で `auth.getClaims()` を呼び、未ログインを `/auth/login` へ転送する挙動と矛盾しない。
- `git diff --check eeccbd0 7d36cfe`、対象ファイルESLint、`tsc --noEmit --incremental false` は独立再実行して成功。
- ブラウザ/Auth操作、360px・390pxの実表示は未実行。認証設定済み環境での画面確認には認証済みセッションが必要。
- UI-01の `9694d86` にある文書リンクの実体はintegration取り込み後にcoreが確認する。
