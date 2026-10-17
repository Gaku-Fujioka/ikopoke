# Task：AUTH-03 認証画面とアプリへの導線を実接続前に整える

状態：ローカル自己確認済み・人間レビュー待ち・実接続待ち
優先順位：優先A
作成日・更新日：2026-10-17

## Goal

既存のメール認証をここいこの日本語画面につなぎ、設定前・失敗・再設定を扱う。実サービス接続の完成とは分ける。

## Background・要件ID

F-01、N-02/03/04/05/10、Q-01。D-007で初期方式を決定した。現在はログイン後にスターターへ進み、PKCE callbackがない。
開発用Supabaseはユーザー回答により未作成。既存のデモ業務データは引き続きブラウザ内保存。

## Requirements・Done

- ログイン後は既定で`/app`、未認証時に開いたアプリ内URLには検索条件を保持して戻る。外部URL・Authループは拒否する。
- 登録・再設定のメールからPKCEコードまたはtoken hashを検証してから遷移する。失敗時にproviderの生メッセージやcode/tokenをURLへ載せない。
- 認証画面を日本語化し、未設定時は送信不可とデモ導線を表示する。二重送信と失敗時の偽の成功を防ぐ。
- アプリにログアウト導線を用意する。DB共有やユーザー別保存ができると表示しない。
- 設定手順・自動検証・実接続前の制限を記録して、固定commitを人間レビューへ渡す。

## Out of Scope・Constraints

グループ権限、業務テーブル、migration、Storage、OAuth、本番適用、deploy。依存の追加なし。
READMEの既存編集、旧スターター削除、未追跡pnpmファイルは変更・stageしない。秘密情報は値を記録しない。

## 変更対象

`app/auth/`のlayout・login・confirm・callback・error・登録完了、認証フォーム、ログアウト、アプリのアカウント表示、
`lib/auth/safe-next-path.ts`、Supabase proxy、回帰テスト、CIのテスト対象、TASKS・decisions・frontend・data-model・verification・設定手順。

## 依存・担当

AUTH-01/02、D-007。実装・文書は本Agent単独。branch：`feat/auth-app-entry`。
実Auth検証にはユーザーによる開発用Supabase作成・環境設定と試用アカウントが必要。
別レビューは固定commitを人間へ渡す。Agentは追加起動しない。

## Verification

`npm run lint`、`npx tsc --noEmit`、既存Node回帰テスト、`npm run build`。
ブラウザでは360/390/1280pxで未設定時の表示・日本語・遷移・欠落callback・エラー表示を確認する。
実メール、ログイン正常/失敗、Cookie更新、再設定、再ログインは開発設定後の別検証。モック試験は実接続の証拠にしない。

## 結果・レビュー対象

基準は`bb11b1d`、実装の固定commitは`5b2af74`。既存の未コミット変更は対象外。
[Draft PR #1](https://github.com/Gaku-Fujioka/kokoiko/pull/1)で人間レビューへ渡す。人間レビューとブラウザ検証前なのでmainには未マージ。

- 実装：日本語フォーム、未設定時の送信抑止、アプリへの復帰、PKCE/token hash確認、固定エラー、セッション更新、ログアウト導線、設定手順。
- ローカルlint・型検査・build成功。回帰テスト19件成功（認証Route Handlerは試験用provider、実Authではない）。
- HTTP確認9件成功。ブラウザ操作は利用可能ブラウザがないため未実施。実Auth・Cookieの実接続・メール・共同利用は未確認。
- 初回の古い生成型による型検査失敗は、build後の再検査で解消。モジュール形式のNode警告とNextのpartialPrefetching案内は残る。依存・設定の無関係な変更はしない。
- 自己レビュー：外部転送／Authループ／不正token種別／失敗時の情報漏れ／未設定時の操作／既存デモとの境界を確認。独立レビューは未実施。
- `feat/auth-app-entry`をpush済み。`5b2af74`の[GitHub CI](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39015073943)は`npm ci`・lint・型検査・19件のNodeテスト・buildすべて成功。
- 以前のローカルmain `bb11b1d`もユーザーのpush許可に従って公開し、[mainのCI](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39015018628)成功を確認。AUTH-03のmainマージ、deploy、外部DB変更はしていない。
- 変更docs内のローカルリンク81件を確認し、欠落なし。検証用ローカルサーバーは停止済み。

## 次のタスク

AUTH-04：開発用Supabaseの接続・実メール・ログイン・ログアウト・再設定を検証。
その後DATA-01/GROUP-01でグループ・招待・個人利用・競合の規則を決め、業務データの保存へ進む。
