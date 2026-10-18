# SOCIAL-01：個人用のグループ色と共有プロフィール

状態：実装・開発DB反映済み。実画面確認待ち、main未統合。2026-10-18。要件F-01/02/06/07、N-01/02/03/04。D-028。

## Goal / Scope

白い吹き出し、部分配色、グループの写真/説明、共通の個人写真を実画面へ接続する。グループ色は本人だけの設定、プロフィールは共有する。有効な招待を確認したログイン済みユーザーにはグループ情報のみ先に見せる。

- 対象：`components/home/`、プロフィール/グループ設定/招待/会話の表示、`lib/presentation/`、Server Action、型、非公開Storageとmigration、既存の削除処理、関連テスト/CI/docs。
- 対象外：ホーム全体の順序変更、地図API、通知、PWA、メール設定、mainマージ。アクション別の不規則な形と全面のパステル色は不採用。
- 小さい仮定：説明500文字、入力画像JPEG/PNG/WebP 10MB、保存用JPEG 1600px/2MB、現在の写真との期待値照合、写真のない場合は既存の文字/アイコンで成立する。サンプル写真や人物は保存しない。
- branch：`design/white-orange-preview`。基準`b917302`。README、旧starter削除32件、pnpm未追跡2件、work/は開始前の変更で保全、stageしない。
- 実装・文書・自己確認：本Agent。別レビュー：独立実施とは報告しない。DB適用とローカル確認、CIを分けて記録する。

## Done / Verification

- [x] 自分用の色が他メンバーに影響せず保存され、ホーム/近況/グループへ反映する。
- [x] グループ写真/説明と個人写真を追加・変更・解除でき、権限と競合を検証する。
- [x] 招待の有効性/ログイン/共同所属に応じて写真への直接アクセスも制御する。
- [x] 未完了送信と古い画像の整理、最後のグループ/アカウント削除を検証する。
- [x] 関連Node/DBテスト、lint、型、build、自己レビュー、CI/実画面/DB適用の状態を記録する。
- [x] 専用ブランチに保存し、mainへマージしない。

## 結果

- 実装：白い吹き出し/部分配色、グループの個人用8色・共有写真/説明、全グループ共通の個人写真、ホーム/近況/会話/所属メンバー表示、ログイン後の招待プレビュー。既存ホーム順序を維持。グループ名の識別アクセントも一覧で本人色を使用する。
- 保存：画像はブラウザでJPEGへ正規化・縮小し、予約UUIDの再利用、実体のサイズ/MIME照合、公開写真の比較による競合防止、未完了画像の再確認/取消・古い画像の整理を実装。既存の非公開bucketを拡張し、写真なしでも文字/アイコンで成立する。
- ローカル：全319テスト成功。追加の共同所属アバター照会・退出後の共有写真の保全/整理を含む関連20件、削除の補強後に関連13件も成功。lint、npx tsc --noEmit、Edge handler単体型検査、production build、PostCSS構文検査成功。既存のNext partialPrefetching/Node module種別の警告は残る。
- 開発Supabase：対象gszekiwwrxlkorqfrdvdを構造/履歴で確認し、group_profile_presentationを実version 20261018115447で適用。削除と送信が重なった時のaccount lock取得後の再確認を追加migration harden_profile_upload_lifecycle（実version 20261018115842）で補強。ローカルファイル名を実versionへ同期。新規3表のRLS、公開7RPCのSECURITY INVOKER/空search_path、匿名実行不可、画像の直接CRUD拒否、Storageポリシーと履歴を確認。削除Edge Functionはリモート既存v1とmainの同一性を確認後、後方互換のpath検証をv2として配備、JWT検証trueを維持。実ユーザーデータ/環境変数値の取得・テスト画像保存・実アカウント削除は行っていない。
- Advisor：新規profile_media/非公開招待閲覧表の[ポリシーなしINFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)は、直接CRUD権限を剥奪した拒否設計。新規索引の[未使用INFO](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)あり。既存のrls_auto_enable匿名実行、従来RPCのSECURITY DEFINER実行、[漏えいパスワード保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)、groups.created_by等の索引指摘は別課題として変更しない。今回追加した公開RPCへのSECURITY DEFINER警告はない。
- 自己レビュー：差分と新規ファイル、権限、予約/競合/再試行、退出/アカウント削除との整合を確認。D-009に従い独立レビューは未実施と記録。
- 実画面：ローカル/appはHTTP307でログインへ誘導。操作可能なブラウザ/ログインセッションは未接続のため、モバイル表示・写真選択/保存/解除・別アカウント・招待プレビューの手動確認は未実施。テストのSSR表示確認とは区別する。
- GitHub：既存[draft PR #34](https://github.com/Gaku-Fujioka/kokoiko/pull/34)へ専用ブランチを保存する。mainへはマージしない。対象commitのGitHub CIはPRのChecksを参照し、ローカル成功と区別する。

操作確認はチャットで案内し、別の設定手順mdは作成しない。
