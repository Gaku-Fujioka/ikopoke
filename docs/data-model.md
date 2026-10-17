# データモデル：現状と設計案

調査日：2026-10-03。これは確定スキーマではない。
[要件§6](kokoiko-requirements.md)と旧`kokoiko-dev-starter/docs/data-model.md`の初期案を参照する。
同じ内容のdatabase.mdは作成せず、データの案内は本書へ統一する。

## 確認できた現状

ITEM-02：D-012の共有候補をローカルに実装。`items`はグループ・名前・spot/activity・メモ・登録者・登録日時を保存する。
所属者だけSELECTできるRLSと`create_item(uuid,text,text,text,uuid)`を追加。作成はセッションの所属・入力を確認して行い、同じrequest UUIDと同じ内容の再送では重複を作らない。内容・グループ・登録者の異なる再利用は拒否する。
直接INSERT/UPDATE/DELETEは公開せず、名前100文字・メモ2,000文字をDBでも制限する。外部キーの削除はRESTRICTで、削除と保全の仕様を確定した意味ではない。
`create_items`は実適用version `20261017112451`で成功し、定義・権限・履歴も確認済みとユーザーが報告した。ローカルのファイル名を`20261017112451_create_items.sql`へ同期し、本文は維持する。実アカウントの追加・詳細再読込・一覧復帰後の名前とメモの保持もユーザー確認済み。別アカウントでの共有は未確認。
既存モックの候補と反応・計画・思い出は別データのまま。自動移行や紐付けは行わない。

2026-10-17追記：Authの基本正常系（メール確認、再ログイン、再読込、再設定と新パスワード）はユーザーが確認済み。
GROUP-02ではグループと初期所属のmigration・型・RPC・RLS・画面をリポジトリへ追加した。
PostgreSQLでのローカル検証は成功。ユーザーが別の接続先チャットで調査・適用し、`create_groups`の実適用version `20261017091513`、2テーブル・関数・RLS・権限・履歴の確認成功を報告した。
ローカルのmigration名は実適用versionへ同期済み。SQL本文は維持した。本Agentは匿名RESTの両テーブルSELECTとRPCの拒否を確認。ユーザーは実ログインで作成・再読込・一覧への復帰後の保持を確認済み。構造・履歴の直接照合と所属別REST操作は未実施。
[GROUP-02](tasks/GROUP-02.md)とD-008が現在の範囲。以下の箇条書きは2026-10-03の初回調査として残す。

GROUP-03はD-010の複数人向け招待。`group_invites`にはtokenハッシュ・期限・無効化日時を保存し、所属者へ管理用メタデータだけを公開する。
限定RPCで認証と権限を検証し、参加時は招待行をロックして有効性と確認済みの参加先を照合する。複合主キーで再参加の重複を防ぐ。
追加migrationはローカルPostgreSQLで検証済み。ユーザーが接続先チャットでの実適用version `20261017094719`と定義・権限・履歴の確認成功を報告し、ローカルのファイル名も同期する。
本Agentは実開発プロジェクトで匿名RESTの招待テーブル取得と4関数の拒否を確認した。実JWTによる招待参加は未確認。

- [lib/supabase/](../lib/supabase/)はAuth用クライアントとCookie連携。
- 認証の利用はコード上に存在するが、外部Supabaseの設定・接続成功は未確認。
- 業務テーブルの定義・migration・SQLファイル・生成DB型・DB更新処理はリポジトリ内にない。
- `supabase/migrations/`もない。外部DBにもテーブルがないとは断定しない。
- `auth.users`は旧案の参照先。実プロジェクトのテーブルを確認したものではない。
- [tutorial](../components/tutorial/fetch-data-steps.tsx)の`notes`作成・公開RLS・取得例は文字列。
  テーブルの実在や適用済みポリシーの証拠ではない。
- Storage bucket・ポリシー・アップロード／画像取得の実装は確認できない。

実DBの読み取り調査はDATA-01で接続先と許可範囲を確認してから行う。
秘密情報の値や本番データは報告へ出さない。

## AUTH-01：実接続前のコード棚卸し（2026-10-03）

**以下は当時の履歴**。2026-10-17のAUTH-03でログイン・パスワード更新後を`/app`へ接続し、
PKCE callback・日本語UI・未設定時の案内・ログアウト導線を追加する。
登録メールは`/auth/callback`、再設定メールは`/auth/callback?next=/auth/update-password`へ進み、codeを交換してから画面へ移る。
token hash方式も継続するが、遷移先はアプリ画面または再設定画面に限定し、失敗理由は固定値にする。
初期の認証方式は[D-007](decisions.md)でメール＋パスワードに決定。開発用Supabaseは未作成とユーザーから確認した。
[設定と実接続の検証](auth-setup.md)はAUTH-04。DB・グループ・RLS・Storageは未実装のまま。

これはローカルコードの読み取り結果で、Auth方式の採用や接続成功ではない。

- `components/login-form.tsx`はメール・パスワードで`signInWithPassword()`を呼び、成功時に`/protected`へ遷移する。
- `components/sign-up-form.tsx`は`signUp()`を呼び、メール確認の遷移先に`/protected`を指定する。
- `components/forgot-password-form.tsx`は`resetPasswordForEmail()`を呼び、再設定先に`/auth/update-password`を指定する。遷移先の`components/update-password-form.tsx`は`updateUser()`後に`/protected`へ遷移する。
- `components/logout-button.tsx`は`signOut()`後に`/auth/login`へ遷移する。`components/auth-button.tsx`と`app/protected/page.tsx`も`getClaims()`を呼び、後者は未認証時にログインへ転送する。
- `app/auth/confirm/route.ts`は確認トークンを`verifyOtp()`で扱う。実際のメール・redirect設定は未確認。
- 同Route Handlerの`next`クエリは`safeNextPath()`でアプリ内パスへ制限し、外部などの不正値は`/`へ戻す。アプリ内パスのqueryとfragmentは保持する。実Authでの確認リンク動作は未検証。
- `lib/supabase/proxy.ts`は公開用環境変数がある場合に`getClaims()`を呼ぶ。`/app`を含む未認証のパスは`/auth/login`へ転送する。環境変数がない場合はこの確認を飛ばす。
- P1の`lib/kokoiko/mock-repository.ts`はブラウザの`localStorage`専用。Supabase AuthのユーザーやDBと紐付いておらず、共有・権限制御を提供しない。

次の実接続タスクにはログイン方式（Q-01）、招待・退会・管理操作の権限（Q-02）、個人利用（Q-03）、同期と競合（Q-15）、対象の開発環境・接続先が必要。
まずAuthの遷移と所属の契約を決め、その後に現行DB・RLS・Storageを読み取り調査する。
外部のスキーマがないと推定してmigrationを適用しない。実APIを使う試験は接続先と費用条件の確認後に分ける。

## 旧モデルから引き継ぐ論理案

以下は設計候補。テーブルの存在・採用・DDL・カラム必須性を意味しない。
具体的な型・外部キー・削除規則・index・制約は対象タスクで採用確認する。

| 候補 | 主な関係・情報 | 要件ID |
|---|---|---|
| profiles | Authユーザーとの対応、表示名、avatar | F-01、F-02 |
| groups / group_members | グループと所属ユーザー、参加日時 | F-02 |
| lists | グループ内の分類 | F-03 |
| items | グループ、分類、spot／activity、title、メモ、優先度、登録履歴 | F-04、F-05 |
| spots | itemに対応する場所詳細、住所、座標、URL、外部識別子 | F-04、F-12 |
| reactions / comments | itemとユーザー、現在の反応または本文・投稿履歴 | F-06 |
| outings | グループ内の計画、日付、計画モード、進行状態 | F-08 |
| outing_items | outingとitem、順序、時刻／時間帯、メモ | F-08、F-10 |
| anniversaries | グループ、日付、年次繰返し、メモ | F-09 |
| memories | outingに対応するアルバム、表紙 | F-11 |
| memory_entries | アルバム内の記録、訪問先との関係、写真パス、メモ、順序 | F-10、F-11 |

旧案の`items.list_id`は単一分類の仮案。Q-04は未決定。
`active / visited / archived`を排他的な状態にする案では再訪・訪問済みかつアーカイブを
十分扱えないため、Q-07・Q-10の検討なしで確定しない。
反応のitemとuserの組の一意性は要件書の提案。制約はまだ適用していない。
`planning / upcoming / in_progress / completed`も状態案で、日程確定・中止・再開は未確定。
別の訪問イベント構造、評価、写真一覧、訪問先snapshotの採用も未決定。

## グループ分離・認証・RLS・Storage

既存方針は所属メンバーだけがグループデータを扱い、通常の共有情報は基本全員編集可能。
管理操作や他者コメントの権限まで確定したものではない（Q-02）。
次はF-01・F-02、N-04と要件§6の設計・検証対象で、現状の保証ではない。

- 親rowまたは親経由でgroup所属を検証する。認証済みというだけで許可しない。
- 別グループのlist、item、outingを子rowへ混入できないよう関係を検証する。
- RLSでDBの直接取得・更新も制御する。画面の非表示だけに依存しない。
- 招待・退会・除外後のアクセス、所属変更、反応・コメントの更新主体を定義する。
- Storageも所属を検証する。URLや画像パスを知っているだけで取得できない設計を検討する。
- bucket公開範囲、画像取得方法、署名URLの期限・退会後の扱いは未決定。
- `service_role`相当の秘密鍵をBrowserへ渡さず、RLSなしでユーザー所有データを公開しない。
- tutorialの`using (true)`は公開読み取り例であり、ここいこの所属制御へ流用しない。

検証は未認証／所属メンバー／別グループで分け、ID・写真パスの直接指定も含める。
実施前提は[verification](verification.md)を確認する。

## migrationと履歴保全

DB変更は必ずmigrationとして残す。これは旧ルールから継続する方針。
現在はmigrationの実行方法・環境・既存履歴が未確認のため、架空の適用コマンドを置かない。
実装時には現行スキーマと差分を比較し、ローカル検証と本番適用を分ける。
本番相当データをSQLへ直書きせず、バックアップ・復旧方針は公開前に確認する。

要件書の保全提案：訪問済みとアーカイブを分け、再訪で過去の評価・写真を上書きしない。
候補の編集・削除・退会で過去の思い出を失わない方法を検討する。
予定終了・思い出生成・二重送信の再実行を考慮する。更新競合も無言の上書きを避ける案を検討する。
方式は採用前にdecisionsへ記録し、本書を適用済みスキーマに見せない。

## 実装前に決めること

未決定事項の詳細は要件§10が正本。判断と状態の管理は[decisionsの未決定一覧](decisions.md#未決定事項)。
P2設計前：Q-01〜Q-04、Q-07、Q-15。関連付け前：Q-06。
フォーム設計：Q-05。P3：Q-09・Q-14。P4：Q-10・Q-12。
外部API：Q-11。画像の外部保存条件も採用サービスの公式資料で確認する。
解決したQだけを本書の設計へ反映し、未解決項目は保留する。
