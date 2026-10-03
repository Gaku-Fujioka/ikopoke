# CORE-01 固定コミットの独立レビュー

- 基準: `8762c5c`。対象: `f82da63` の `lib/kokoiko/contracts.ts`、`lib/kokoiko/mock-repository.ts`、`tests/mock-repository.test.mjs`。
- 判定: 修正が必要。対象はP1のローカルモックであり、実認証・DB・グループ権限の検証結果ではない。

## 指摘1

**中／`lib/kokoiko/mock-repository.ts:105-111,120-125,129-138`／入力の列挙値と日付を実行時に検証せず保存する。**

- 再現手順: `createMockRepository` にメモリStorageを渡し、`createItem("demo-group", {kind:"invalid",title:"abc"})`、`createOuting("demo-group", {title:"test",date:"2026-99-99"})`、`setReaction("demo-group", item.id, "stranger", "invalid")` を順に呼ぶ。
- 期待結果: 候補種別、リアクション値、日付形式が契約外なら保存前に拒否し、理由が分かる。
- 実際の結果: `kind:"invalid"`、`date:"2026-99-99"`、未知のメンバー名と反応値が読み戻せる。TypeScript型は実行時入力を検証しない。
- 修正案: 永続化の入口で `kind`、`ReactionValue`、日付を検査する。モックで許す操作主体を `MOCK_MEMBER_ID` に限定するか、任意memberIdの意味と非認証の制限をUI契約に明記する。

## 指摘2

**中／`lib/kokoiko/mock-repository.ts:47-65,78-80`／ローカル保存データの浅い検証で壊れた要素を通す。**

- 再現手順: Storageから `{"group":{"id":"demo-group","name":"demo","memberNames":[]},"items":[null],"outings":[],"memories":[]}` を返す。`read("demo-group")` は `items[0] === null` のまま成功し、`setReaction("demo-group", "missing", "demo-member", "want_to_go")` は `TypeError: Cannot read properties of null (reading 'id')` で落ちる。
- 期待結果: 壊れた保存内容を読み込み時に判定し、制御された「モックデータを読み込めません」のエラーを返す。画面が不正な要素を描画しない。
- 実際の結果: 外形の配列チェックだけが通り、読み取り成功の後に別操作やUIで例外になる。
- 修正案: 少なくともgroupと各配列要素の必須形を検査する。破損時の回復手順は別途UI側と合わせる。

## 確認結果

- `node --experimental-strip-types --test tests/mock-repository.test.mjs` を実行し、2件成功。再実行時にNodeのmodule type警告は出たが、テスト失敗ではない。
- 指定外グループのread、別グループ候補IDの計画への紐付けは既存テストで拒否を確認。実装上、グループIDが一致するモックの1グループだけを扱う。別ユーザーや実DBの権限は未確認。
- 同じおでかけの終了を2回呼んでも、同じ思い出IDで1件だけ残ることをテストで確認。
- Storageの `setItem` が例外を投げる再現では、`createItem` は成功値を返さず、後続の `read` でも件数は増えていない。表示文言への変換はUI未接続のため未確認。
- 型検査と対象ファイルlintの成功、全体lintの既存 `tailwind.config.ts` 失敗はcoreからの申告。今回は独立再実行していない。`f82da63` の固定差分には `tailwind.config.ts` は含まれない。
- UI worktreeの後続変更やcore worktreeの `f82da63` 後の変更は対象外。
