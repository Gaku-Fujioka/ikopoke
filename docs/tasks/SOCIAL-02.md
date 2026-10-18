# SOCIAL-02：識別しやすいグループ色と作成時のプロフィール

2026-10-18。実装・開発DB反映済み。CI確認後に統合。F-02/11、N-01/02/03/04。D-029。

- Goal：テーマのオレンジと区別できる8色、全体/グループ内の思い出の本の枠線、作成時の任意写真/説明。
- 対象：presentation palette、アルバム一覧、グループ作成フォーム/Action/RPC、既存画像処理の共通化、関連テストとdocs。
- 対象外：ホーム順序、画像公開範囲、テーマ色、既存記録や色設定の削除、通知/PWA/メール。
- branch：design/white-orange-preview、基準d76117b。README・旧starter削除32件・pnpm未追跡2件・work/は保全する。
- 仮定：あんずの保存キーは互換性のため維持し、表示をベリーへ変更。8色を保持し、オレンジ系は用意しない。説明500文字と写真制限は既存どおり。
- 保存：名前/説明は1トランザクション、写真は非公開Storageで予約→送信→完了確認。同じUUIDで再試行し、写真だけ失敗した場合は作成済みを明示し、再試行/写真を後から設定して開く導線を用意する。
- Done：任意項目なし/説明のみ/写真あり、無効入力、認証/所属拒否、再送/途中失敗/重複防止、画像の権限/削除を確認。色のコントラスト/識別差と本の実際の色参照、モバイルフォーム構造を確認。
- Verification：全Node/PGliteテスト、lint、型、build、差分自己レビュー、開発DB定義/権限、最新PR CI後にmainへマージしmain CIも確認。実画面操作の可否を別途記録する。
- 担当：本Agent。独立レビューは実施したと扱わない（D-009）。ユーザーが「基本大丈夫」と既存SOCIAL-01を確認し、今回の実装・十分な検証後のmainマージを許可した。

## 結果

- 要件照合：8色をベリー/レモン/ミント/空色/ソーダ/さくら/ライラック/スレートに調整。旧キーを保持し、本人の設定・他メンバーの設定は変更しない。オレンジを含む従来のtone変数も本人色へ連動し、全体/グループ内のアルバムの枠線と本の背へ反映する。
- 名前のみ/説明のみ/写真付きの作成を実装。写真は作成前に形式/サイズを検証してJPEGへ縮小・再エンコード。名前/説明は単一RPC、写真は既存の非公開Storageで同じUUIDの予約→送信→完了確認。途中失敗は作成済みIDを保持し、再試行は写真だけ、後から設定して開くことも可能。未完了予約は既存設定画面で確認/整理できる。
- ローカル全330件成功。作成の正常/匿名/本人なし/他人のID/長さ/削除中/再送後の共有編集保全、写真の応答喪失/ready再送/完了失敗/正規化を検証。フォームの必須項目・説明・写真のSSR描画、アルバムへの本人色渡し、既存ホーム/招待/画像権限/退出/アカウント削除も確認。PGliteは本物のJWT認証や別セッションの同時接続試験とは区別する。
- lint、npx tsc --noEmit、production build成功。PostCSSで枠線が--kk-group-markを参照することを確認。8色の枠線対白は最低4.41:1、淡い下地の本文は最低12.73:1。色以外にグループ名と選択ラジオを表示。色覚特性ごとの視覚評価は未実施。
- 開発DB：gszekiwwrxlkorqfrdvdの既存RPC未作成を確認後、create_group_with_profileを実version20261018122340で適用。ファイル名を同期。公開SECURITY INVOKER/非公開SECURITY DEFINER、空search_path、匿名EXECUTE不可を照合。既存の画像権限/削除方式は維持。実ユーザーデータの取得/テスト画像送信は行わない。
- Advisor：新規公開関数への警告なし。以前からの[ポリシーなしINFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)は直接CRUDを剥奪した画像/招待閲覧表。既存のrls_auto_enableと従来RPCの実行警告、[漏えいパスワード保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)は別課題として維持。新規テーブルや新規Storageポリシーは追加していない。
- 公式[Storage upload](https://supabase.com/docs/guides/storage/uploads/standard-uploads)と[アクセス制御](https://supabase.com/docs/guides/storage/security/access-control)、changelogを確認。新しい外部APIや依存は追加していない。
- 自己レビュー：今回の差分と未追跡新規コード、再試行/競合/権限/既存変更の保全を確認。独立レビューは未実施（D-009）。
- 実画面：cuaのapps/browsers一覧が空のため実機の操作/スマホ画面は未実施。既存UIはユーザーが基本大丈夫と報告。今回のSSR/保存テストと実ブラウザの確認は区別する。
- GitHub：既存PR #34を更新し、最新commitのCI成功後に、D-029に従ってmainへ統合する。統合commit/CIは[PR #34](https://github.com/Gaku-Fujioka/kokoiko/pull/34)の状態・ChecksとmainのCIを参照する。
