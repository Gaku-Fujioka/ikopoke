# MAP-01：手動でひらく地図と新しい場所の検索

2026-10-18。状態：実装・自動検証済み、実API未接続。担当：本会話のAgent単独。

## Goal・採用範囲

F-12とF-04/07、N-01/02/03/05/07/08。メール・地図の導入希望と、学生特典待ちの間に進める実装依頼に基づく。
ホームの既存枠にGoogleマップを明示操作で読み込み、場所名/エリアの送信で新しい場所を最大5件検索し、選択した位置を表示する。
API未設定でも既存候補の名前検索・手入力を維持する。スポット詳細には今すぐ使える外部Googleマップの名前検索を付ける。

## 対象外・依存

- 外部契約/課金有効化/キー作成/実APIリクエストは実施しない。Supabase・DB・依存の変更なし。
- Google検索結果から候補への直接保存、保存済み候補のピン、Place Details、写真/営業時間/評価、現在地は後続。位置を持たない既存候補へ架空のピンを置かない。
- Googleの検索結果はマウント中のメモリのみ。DB/localStorage/sessionStorage/アプリのURL/ログへ写さない。外部Googleマップのリンクだけに検索語とplace IDを渡す。
- Maps/Placesを別々の環境変数で無効化。両方falseが初期値。APIキーだけでは有効にならない。
- 有効化前にGoogle Cloudの請求・参照元/API制限・クォータ/アラートと公開利用規約/プライバシーポリシーを確認する。公開文書の内容は未確定で、今回作成・公開しない。
- ブラウザ用キーは公開を前提とする。秘密キー/サービスアカウントは使用しない。.env.localは読取/変更/コミットしない。

## Doneと変更範囲

- SDKは地図を押すまで挿入しない。同じ文書で一度だけ、失敗時に自動再試行しない。APIライブラリは地図→検索→マーカーを必要時だけ取得する。
- 検索は送信時だけ、1回最大5件。入力中・移動中・再描画・ポーリングによる呼出なし。検索中の連打を抑止する。
- fieldsはid/displayName/formattedAddress/location/attributions。写真・口コミ・Place Detailsの呼出はゼロ。地図帰属表示を隠さず、追加提供元もテキスト/安全なリンクで表示する。
- Loading/未設定/検索0件/検索失敗/SDK認証失敗を区別。生のproviderエラーやキーをUI/ログに出さない。
- 破棄後の検索・初期化・マーカー応答を無視し、古い結果を再表示しない。地図は日本全体から開始し現在地を要求しない。
- 変更対象：lib/maps、components/maps、ホームの地図枠、スポット詳細リンク、CSS、.env.example、CI/関連テスト、当タスク/決定/TASKS/frontend。既存README/旧資料削除/pnpm/workは除外。
- branch: feat/maps-explorer。基準commit: b42cc1386f535332a18aef4072c2fbce13f687fa。単独自己レビュー（D-009）、独立レビュー未実施。

## 公式資料と費用の境界

2026-10-18に現行の公式資料を確認。
[SDK読み込み](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)、[Text Search New](https://developers.google.com/maps/documentation/javascript/place-search)、[フィールド](https://developers.google.com/maps/documentation/javascript/reference/place)、[Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/overview)。
[保存/帰属と公開ポリシー](https://developers.google.com/maps/documentation/places/web-service/policies)、[キー制限](https://developers.google.com/maps/api-security-best-practices)、[料金](https://developers.google.com/maps/billing-and-pricing/pricing)、[費用管理](https://developers.google.com/maps/billing-and-pricing/manage-costs)。
今回の選択フィールドはText Search Pro、地図はDynamic Maps。現行の無料使用上限は各5,000/10,000件/月。超過はそれぞれ初段階32/7米ドル・1,000件あたり。7人でも回数次第で変わる。予算アラートは支払上限ではない。金銭的ハード上限や無料保証として扱わない。

## 検証・残作業

追加の地図テスト14件と、スポット/活動の地図リンク表示1件が成功。SDK挿入回数・送信/連打・範囲/エラー・マウント破棄・帰属URL・SDK認証失敗・遅いマーカー・SSRの無通信を、偽SDKで確認。実サービスの成功とは区別する。
全287件のNodeテスト・lint・型検査・本番build成功。最終の小修正後も関連25件とlint成功。最終headのGitHub CI・main統合はPRへ記録する。自己レビューで離脱中のSDK初期化を中断し、検索失敗時の古いピンと遅いマーカーの再表示を防止した。独立レビューは未実施。
実キーが未設定のため実地図/検索/クォータ拒否、390px/360pxの実地図と帰属表示、実Googleでの検索結果は未確認。
外部設定手順とユーザー確認事項はチャットで案内する。
