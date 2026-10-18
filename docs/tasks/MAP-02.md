# MAP-02：検索結果の一括ピンと写真・口コミ

2026-10-18。状態：実装・自動検証済み、実画面確認待ち。担当：本会話のAgent単独。

## Goal・採用範囲

F-12/07、N-01/02/03/05/07/08。ユーザーが検索時点でピン表示し、スポット選択時にGoogleの写真・口コミを見たいと明示依頼した。
検索結果の最大5件を自動でGoogleマップに表示し、全件が見える範囲へ移動する。ピン/一覧どちらからでも同じ選択と詳細欄を開く。

## Requirements・Done

- 地図を再生成せずに検索結果の全ピンを更新する。検索直後に勝手に1件を選ばず、選択前のDetails/写真リクエストはゼロ。
- 選択時にPlace.fetchFieldsでrating/userRatingCount/photos/reviews/attributionsだけ取得。検索のfieldsは従来のProを維持する。
- 写真は最初の表示可能な1枚（最大800px）だけ、口コミはGoogleの返す順で最大5件。星と評価数を表示。全写真/全口コミはGoogleマップへ。
- 著者名/提供されるプロフィールと画像、個別の写真/口コミの元リンク、Google Maps帰属、翻訳時の原文を表示。個別sourceがないデータは安全に省き、空/通信失敗/読込中を区別する。
- Googleコンテンツはメモリ内のみ。DB/ブラウザ保存領域/アプリURL/ログへコピーしない。画像はブラウザから直接読み込み、Next画像キャッシュへ保存しない。
- 同じ選択のloading/readyで重複取得しない。別スポット/再検索/離脱で古い詳細を無視。キャンセル済み応答では写真URIも生成しない。失敗は詳細欄に限定し、手動で再試行できる。
- キーボードでピンを選べ、選択先の詳細へフォーカスを移す。外部URLはHTTPSのみで資格情報を含むURLと実行スキームを拒否し、本文はReactでエスケープする。

## 対象外・制約

DB・Auth・依存・キー/クォータ/請求先設定・配備は変更しない。.env.localは読み取り/変更/commitしない。候補への保存/保存済み候補のピン/検索5件より多いページング/全口コミ/写真ギャラリー/現在地は後続。
既存README・旧資料削除・pnpm関連・workを保護。公開利用規約/プライバシーの整備と公開前確認は引き続き未完了。今回の導入を公開準備完了としない。

## 費用・公式根拠

2026-10-18の公式資料で確認。口コミを含むDetailsはEnterprise + Atmosphere、写真の画像取得はPhotos SKU。各月1,000件の無料使用上限、超過の初段階はそれぞれ25/7米ドル・1,000件あたり。前段の月100円予算通知は自動停止を保証しない。ユーザーの今回の明示依頼の範囲で、選択した1件だけ取得する。
[Details](https://developers.google.com/maps/documentation/javascript/place-details)、[fieldsとSKU](https://developers.google.com/maps/documentation/javascript/place-class-data-fields)、[料金](https://developers.google.com/maps/billing-and-pricing/pricing)、[写真](https://developers.google.com/maps/documentation/javascript/place-photos)、[口コミ](https://developers.google.com/maps/documentation/javascript/place-reviews)、[帰属/保存条件](https://developers.google.com/maps/documentation/places/web-service/policies)、[マーカー操作](https://developers.google.com/maps/documentation/javascript/reference/advanced-markers)。

## 変更・検証・レビュー

- branch: feat/map-place-details。基準: b669fe733fccac764eba58c53ef1bcb94669a21b。D-009で単独自己レビュー、独立レビューなし。
- 対象: lib/maps/google.ts・explorer.ts、components/maps/place-explorer.tsx・新規place-detail-panel.tsx、CSS、maps-explorerの回帰テスト、TASKS/decisions/frontend/当タスク。
- 関連35件のNodeテスト成功。全ピン/fitBounds/ピン選択/古いピンの無効化/詳細の連打・切替・中断/写真1枚/帰属URL・翻訳・エスケープ/空・失敗を合成SDKで検証。全299件のNodeテスト・lint・型検査・本番build成功。最終headのCIとmain統合はPRへ記録する。
- 前段のMAP-01はユーザーが実検索・ピンを確認済み。今回の一括ピン/写真/口コミは実Googleで未確認。CUAは接続一覧が空で実画面検証未実施。ユーザー確認手順はチャットで案内する。
