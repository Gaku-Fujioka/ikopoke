# REV-06 修正再確認

- 基準: `a89a916`。対象: `45c5795`。
- 判定: 前回の低指摘は解消。残る指摘なし。

## 確認

- `selectedIds` と読み込んだ `snapshot.items` を照合した `validSelectedIds` を作り、チェック状態と `createOuting` の `itemIds` の両方に使う。
- query IDがsnapshotにない場合は `role="status"` で除外を案内する。存在する事前選択はチェック表示と保存入力に残る。
- 無効IDはReact状態内には残るが、表示にもrepositoryへの保存入力にも流れない。既知候補の選択・解除には影響しない。
- `git diff --check a89a916 45c5795` は成功。lint、型検査、HTTP 200とフォーム送信以外のブラウザ操作は依頼者報告。review側でのブラウザ実操作は未実行。
