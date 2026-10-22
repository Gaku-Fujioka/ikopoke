# PERF-02：下部タブの切り替えを滑らかにする

2026-10-22。実装・ローカル検証・自己レビュー済み。CI/統合・公開の最新結果は本変更のPRを正本とする。本Agent単独、branch `perf/tab-navigation`、基準main `8526e3dc1abfcfd51a8587d22e82231e27ed03af`。N-01/02/03/07/08/10、D-038。先行：PERF-01、UI-APP-01、ONBOARD-01。

## Goal・根拠

ユーザーが全体のロードの長さを報告し、「まずはタブの切り替えをスムーズにしたい」と依頼。従来もNext Linkとページ内部のSuspenseは存在するが、ルート用loading.tsxとタブのpending表示はなく、主タブは既定の先読みだった。実機の秒数と主因は未計測。今回の受入条件は待ち時間ゼロではなく、先読みを利用し、待つ場合も遷移先の枠と状態を表示して次の操作を受け付けること。

## 採用範囲・変更対象

- 全体/選択グループの4タブに限定して `prefetch={true}` を指定。現在と同じpathnameへの先読みを省き、招待参加画面では保護ページの強制先読みを止める。追加メニュー・詳細カードへ全件先読みを広げない。
- `useLinkStatus` はLink配下の部品で読み、押したタブに固定サイズのスピナーと移動中の読み上げを表示。履歴更新前の実際の現在地はaria-currentで維持する。独自のタイマー/ルートpush/二重の選択状態を作らず、連打・中断・戻るはNextへ任せる。
- `app/app/loading.tsx` と共有 `components/layout/tab-loading.tsx` を追加。全体/グループのホーム・行きたい・おでかけ・思い出の8ページ内Suspenseも同じ静的スケルトンを使い、ヘッダー/下部ナビを維持する。文字で読み込み中と伝え、装飾を読み上げず、既存のreduced-motion対応を使う。
- 共通部品・AppNav・対象8ページ・globals.css・既存home-uiテスト・TASKS/decisionsと本書を変更する。

## 制約・対象外

- Next/Reactの既存APIを使用し、依存/lockfile/Next設定を変更しない。先読みの対象範囲と再利用はNextのルーターが管理する。先読み完了前や回線不調時に、即時に本文が揃う保証はしない。
- DB/RLS/認証/Storage/保存処理/既存の再取得対象は変更しない。共有サーバーキャッシュ・Service Workerへのユーザーデータ保存・ダミーデータは追加しない。
- 地域変更、Supabase移行、画像の軽量化、全画面のデータ取得改善は別タスク。Vercelはユーザーが米国設定の画像を提示し、シドニーへ揃える方針を選択したが、実際の本番処理地域の切替完了は本Agent未確認。
- 開始前のREADME変更、旧スターター32削除、未追跡pnpmファイルとwork/を保全し含めない。

## Done・Verification

- 全体/グループのタブhref・現在地・追加メニューを維持し、先読みを4主入口へ限定。招待時の強制先読みを抑止する。
- pendingは該当Linkだけに表示され、遷移後に消える。データ未取得でも8ページの待機表示とルートloadingは同期的に描画でき、個人/グループ情報を含めない。
- 既存home-ui検証へ回帰テストを加え、lint・型・関連テスト・本番build・自己レビュー・最新CIを確認する。CI/マージ/公開はPRへ記録し、実操作/速度測定とは区別する。
- 接続ブラウザ/アプリの一覧は空。実スマホの初回/再訪の切替時間、連打/戻る/オフライン、360/390px、VoiceOver・フォーカスの操作は未実施として残す。

公式根拠：[Linkのprefetch](https://nextjs.org/docs/app/api-reference/components/link#prefetch)、[loading.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/loading)、[useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)。APIはローカルの既存Next型でも確認した。Cache ComponentsとPartial Prefetchingの構成によって先読み対象が異なるため、本文の取得量/完了時刻の実測とは区別する。

## 検証結果

- `npm run lint`、`npx tsc --noEmit`、`npm run build` が成功。既存のNext partialPrefetching案内とNode module形式警告は継続。
- `node --experimental-strip-types --test tests/home-ui.test.mjs tests/render-boundaries.test.mjs tests/auth-proxy.test.mjs tests/pwa.test.mjs` の43件が成功。既存home-uiへ追加した3件で、全体/グループ内の先読み対象・招待中の抑止、Linkごとのpending/読み上げ/実際の現在地、全8タブの静的fallbackとDB呼出しなしを確認した。
- 初回の関連テストで既存モックが新しい共通部品/追加で読む画面のexportを持たず失敗。実部品を読み込む境界と必要なexportを更新し、同じコマンドで再検証して成功した。製品処理をテスト都合で変更していない。
- 自己レビューで対象全差分/新規ファイル、4タブとグループの維持、失敗/中断をNextに任せる構造、固定サイズのpending表示、既存キーボードフォーカス枠・reduced-motionの維持、認証/保存/SWの非変更、既存dirty変更の除外を確認。独立レビューはD-009に従い未実施。
- 先読みは表示前の通信を増やす代わりに遷移時の待ちを減らす。Nextが取得済み画面を再利用するため、他メンバーの変更が即時に出る保証はなく、既存の更新操作と保存後の再取得を維持する。実際の先読み通信量、本文表示までの時間、体感改善率は未計測。実ブラウザ/スマホでの成功や地域切替完了を自動テストから推測しない。
