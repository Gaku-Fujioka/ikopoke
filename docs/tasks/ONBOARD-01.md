# ONBOARD-01：初回ログインの使い方ガイド

2026-10-22。状態：実装・ローカル検証済み。CI/統合・公開確認の最新状態は[PR #45](https://github.com/Gaku-Fujioka/ikopoke/pull/45)に記録する。本Agent単独。branch `feat/first-login-guide`、基準main `a44047e27023925ea85c5f1ebbf3bd4d978ccc99`。
F-01/02/10/11、N-01/03/04/05/09、D-037。前提：DEPLOY-01、PROFILE-01。

## Goal・採用範囲

ユーザーが検証用の全データ・登録アカウントの削除と、初回ログインのチュートリアル、後から見返す入口を依頼。内容と進め方はAgentへ委任された。

- 6ステップで「グループ → 行きたいと会話 → 計画 → 写真付き記録 → 思い出」を紹介する。友達・恋人・家族との日常を写真とひとことで残す用途を重視する。
- 初回はモーダルで表示し、あとで見る操作を許可する。そのモーダルの閉じる/読み終える操作をアカウント単位のversionとして保存し、次回ログインや別端末で繰り返し自動表示しない。見返すページは読取だけで動き、保存状態を変更しない。
- プロフィールの「使い方ガイド」から独立したページでいつでも見直せる。プロフィール写真や会計、ホーム画面追加等の既存の導線を維持する。
- 招待の参加画面では自動表示を待ち、参加後の画面で案内する。認証メール、パスワード再設定、招待tokenや参加権限は変更しない。

## 初期化結果（2026-10-22）

- ユーザーの今回の明示依頼で、既知のプロジェクト `gszekiwwrxlkorqfrdvd` を初期化した。前回の初期化は別実行として扱い、今後の新規登録に対して再実行しない。
- 実行前：Auth users 2（利用中1・削除済み残存1）、identity 2、session/refresh token 0、flow state 2。グループ1・所属1・招待1・プロフィール2・表示色1、非公開の削除完了ジョブ1・招待プレビュー用行1。候補/計画/訪問/写真/会計明細とStorage実体は0。
- schemaと全29対象テーブル/件数、ユーザー削除トリガー、外部キーを確認。Storage実体0をガードし、対象全表・Authのロックと件数再確認、時間上限を設けて実行。まず同じ処理をROLLBACKし元の件数への復帰を確認してから、本実行した。
- アプリ29表を明示したCASCADEなしのTRUNCATEと、Authのsession/refresh token/flow state/usersの削除を実施。Authのidentity等は既存FKに従う。結果はアプリ全29表・Auth対象が0件、Storage実体0、非公開bucket 1・既存migration 27件を確認。定義/ポリシー/関数の集約ハッシュは前後とも `b67ad753076f22286d6319eda852601d`。
- この初期化でschema・RLS・bucket・SMTP・ドメイン・環境変数・既存migrationを変更していない。アドレス・名前・本文・キー・招待tokenは取得/記録しない。Supabase/Resendの監査・配送ログはこのアプリデータ削除の対象外。

## 設計・変更対象・制約

- 既存 `profiles` に閲覧済みversion列だけを追加し、同じ本人用RLSと列権限を使う。新しいSECURITY DEFINERや依存は追加しない。初回表示の有無は権限判定に利用しない。
- 取得失敗でアプリの利用を止めない。保存失敗は成功扱いにせず再試行/今回は閉じる操作を案内する。
- 新規：`lib/onboarding/`、`components/onboarding/`、`app/app/guide/`、ガイド用Action、migration、関連テスト。既存：アプリlayout、プロフィール、DB型、CI、TASKS/decisions/data-modelと本書。
- 既存のREADME変更、旧スターター32件削除、未追跡pnpmファイルとwork/は保全。既存データを含めるseed、設定説明のみの新しいmd、依存更新は行わない。

## Done・Verification

- 初回の自動表示・招待中の延期・閉じる/完了後の非表示・プロフィールからの再表示を確認する。
- DBでdefault、本人だけの読取/更新、他人/匿名拒否、負のversion拒否を検証。Actionで認証から本人IDを決め、保存失敗や0件更新を成功扱いにしないことを検証。
- Native dialog、フォーカス、Escape、読み上げ名と進捗、狭い画面のスクロール/ボタンを考慮し、ローカルlint・型・関連テスト・build・自己レビュー・最新CIを確認する。実ブラウザ/スマホでの検証とは区別する。
- 新規migrationだけを検証後に適用し、実定義/権限/履歴・Advisorを確認する。初期化と機能用schema追加の結果は別に記録する。

## 実装・検証結果（2026-10-22）

- 初回の6ステップは既存のポケットアイコン、白/黒と共通のオレンジを使用。Native dialogで表示し、あとで見る/完了で本人の状態を保存する。保存失敗は再試行と「今回は閉じる」を案内し、成功扱いにしない。読み取り失敗は通常画面を妨げない。見返しページ `/app/guide` は保存なしで利用でき、プロフィールに入口を追加した。
- 招待参加画面と見返しページでは自動ダイアログを延期する。参加後は通常画面で案内する。未認証のガイドページは既存proxyでログインへ戻し、認証や招待の保存処理は変更しない。
- 新規migration `20261021152650_account_onboarding_guide.sql` を対象プロジェクトへ適用済み。実際のversionにローカル名を同期し、履歴28件、integer/既定0/NOT NULL、authenticatedの列SELECT/UPDATE、anonの拒否、既存の本人用RLSを確認した。既存migrationも本migrationも再適用しない。適用時点のAuth/プロフィールは0件、確認用ユーザーを作成していない。
- 新規6件とプロフィールDB追加2件を含む関連58件のNodeテストが成功。実コンポーネントのSSR、Actionの認証/本人ID/保存失敗/0件更新、表示済み状態、招待中の延期、既存認証/招待/ホーム、PGliteでのmigration/default/RLS/匿名拒否/制約を検証した。外部Authの実セッションや実ブラウザ操作の代わりとは扱わない。
- `npm run lint`、`npx tsc --noEmit`、`npm run build` が成功。既存のNext partialPrefetching案内とNode module形式警告は残る。自己レビューで対象差分、新規ファイル、権限、失敗時の継続、連打の境界、招待と見返しの導線を確認。独立レビューは実施していない（D-009）。CI結果はPRへ記録する。
- Supabase Security Advisorは適用前後で同じ3種類：[RLS有効・policyなし](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)（INFO）、[anonのSECURITY DEFINER実行権限](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)と[authenticatedの同権限](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)（WARN）。今回、関数・新規テーブルは追加していない。警告を解消済みとは扱わない。
- 接続ブラウザ/アプリの一覧が空のため、スマホの表示/スクロール/タップ、フォーカス/Escape、実アカウントでの初回→閉じる→再ログイン→プロフィールから再表示は未実施。公開反映後の手動確認へ残す。
