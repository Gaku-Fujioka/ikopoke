# VISIT-02・PHOTO-01：訪問記録、個人評価、非公開写真

作成日：2026-10-18。状態：main統合・開発用DB適用・実アカウントの基本正常系確認済み。
担当：本Agent単独。branch：`feat/shared-visits`、基準：`3479057`。

## Goalと範囲

F-10、N-02/03/04/06、D-018。計画からも候補から直接でも訪問を記録し、再訪は別記録として残す。訪問日と2,000文字のメモ、任意の1〜5の個人評価、写真10枚・1枚10MBを扱う。通常の共有メモは全員編集可、個人評価と未完了の写真送信は本人だけが変更する。
候補名を記録時点で保持し、元候補や計画の変更が過去の記録を書き換えない。候補の取外しでも履歴を保持する。訪問・写真の削除、終了/再開、アルバム生成、退会時の保全はQ-07/12の判断待ちとして対象外。

## 実装

- `visits`・`visit_ratings`・`visit_photos`と限定RPC。所属RLS、同一グループの複合外部キー、再送UUID、編集の改訂番号、10個の写真枠の予約と行ロックを使う。
- 訪問一覧は20件ごと。候補・計画ごとの履歴も開ける。本文・評価・写真を別の待機境界にし、写真待ちで本文を隠さない。
- 写真は非公開の`visit-photos` bucket。JPEG/PNG/WebP、10,485,760 bytes以下。Storage APIで送受信・削除し、`storage.objects`はメタデータの読取だけに使う。bucket作成SQLは[公式の作成方法](https://supabase.com/docs/guides/storage/buckets/creating-buckets)を確認した。
- StorageのINSERTは本人のpending予約だけ。完了確認でサイズ・MIMEを照合し、readyになった写真だけ共有する。取消開始後はINSERTを拒否し、Storage APIでの削除を試み、実オブジェクトの不在をDBで確認した後にだけ予約枠を解放する。削除応答の喪失や元から未送信の場合も再試行できる。アップロードのトランザクションは予約行をロックし、取消との競合で未追跡オブジェクトを残さない。
- 写真取得は認証付きStorage downloadと所属RLSを使い、ブラウザ内のblob URLで表示・拡大する。公開URL・署名URL・service keyは使わず、オブジェクトURLは破棄時に解放する。
- リポジトリの既存README変更・旧スターター削除・pnpmファイルは今回のコミットに含めない。外部API契約・プラン変更なし。写真は既存Supabase Storageの利用枠を使う。

## 適用履歴・検証

| migration | 開発用の実適用version |
|---|---|
| record_visits | `20261018003443` |
| visit_photos | `20261018003454` |

対象は開発用プロジェクト`gszekiwwrxlkorqfrdvd`。事前に対象表とbucketが存在しないことを確認し、適用後にRLS・権限・private bucket・容量/MIME制限・3件のStorageポリシー・関数の空のsearch_pathと匿名実行拒否・履歴を確認した。ユーザーデータや認証情報は取得・表示していない。

- ローカル全195件のNodeテスト、lint、型を含むbuild成功。PGliteはPostgreSQLのRLS/関数を検証し、Storage fixtureはメタデータだけを模したもの。実Storage APIのバイト転送・JWT・並行接続試験とは区別する。
- DB7件で再訪・冪等性・名前の保持・古い編集の拒否・個人評価・非所属/匿名拒否・写真の予約/完了/取消・10枠・容量/MIME入力・不一致メタデータを検証。
- Actionと転送7件で入力前検証、認証、利用者IDのなりすまし防止、取消時のStorage APIと予約解放の順序、失敗時の情報保護、応答喪失とready再送を確認。既存の描画境界テストに訪問履歴の独立待機を追加した。
- [認証済みSECURITY DEFINER実行](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)のAdvisor警告は、所属・本人確認付きの限定RPCで意図した構成。新規の外部キー索引不足はなし。[未使用索引INFO](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)は新規表のため保持する。既存の`rls_auto_enable`実行権限と漏えいパスワード保護の警告は今回の変更外。
- 自己レビューで権限、再送、改訂番号の保持、アップロードと取消のロック順、公開URLなし、Blob解放、失敗を成功にしない経路を確認。独立レビューはD-009に従い未実施。[PR #22](https://github.com/Gaku-Fujioka/kokoiko/pull/22)の実装commit `b568a1f`で[CI成功](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39083588069)。mainへマージした`96e4dbc`の[CIも成功](https://github.com/Gaku-Fujioka/kokoiko/actions/runs/39083717585)。
- ユーザーがチャットの確認項目に対して「できてた」と回答。訪問保存/再読込、日付/メモ編集、個人評価の変更/取消、写真保存/再読込/拡大、計画からの再訪後も両記録が残る基本正常系を確認した。
- 複数利用者、モバイル幅/キーボード、送信中断/再試行、枚数/容量上限の実操作は未確認。自動検証と区別する。設定・確認手順はチャットで案内する。
