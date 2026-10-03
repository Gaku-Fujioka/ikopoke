# FLOW-01 固定コミットの独立レビュー

- 基準: `ef10b9f`。対象UIコミット: `bf1323b`、`a89a916`（ui branch HEAD）。確認開始時のui worktreeはclean。
- 判定: 修正が必要（低1件）。FLOW-01の主要な画面契約は概ねつながっている。

## 指摘

**低／`components/flow/new-outing-form.tsx:13-19,38-43,75-80`／無効な `itemId` の事前選択を解除できない。**

- 再現手順: `/app/outings/new?itemId=missing` を開き、計画名を入力して保存する。
- 期待結果: 存在しないIDを無視または解除可能にし、有効な候補だけで計画を保存できる。利用者が無効な選択を識別できる。
- 実際の結果: queryのIDはsnapshotとの照合なしに `selectedIds` へ入る。候補一覧には該当チェックボックスがないため解除できず、repositoryの `findItem` が保存を拒否する。フォームにはエラーが出るが、そのIDを取り除く操作がない。
- 修正案: snapshot読込後にIDを有効候補へ絞り込む、または不明なIDの選択表示と削除操作を出す。候補詳細からの正常な遷移は現行設計どおり事前選択を維持する。

## 確認済み

- 候補作成は必須名を検証し、保存例外を表示して再送可能にする。反応は1操作で切替／取消し。候補から計画へはitemIdを渡す。
- `recordVisit` を計画内候補に呼び、重複送信はrepositoryの冪等性に委ねる。終了前に訪問を明示し、明示訪問だけを思い出へ表示する。終了後の再送は同じMemoryへ移動する設計。
- 詳細の欠落IDは「見つかりません」状態を表示し、一覧に戻るリンクがある。repositoryの入力・localStorage例外はフォーム／操作に応じて捕捉される。
- 保存先は `window.localStorage`。ページ表示の再読込でrepositoryを再読し、ブラウザ内に保持する設計。
- `npm run lint` 成功、`tsc --noEmit --incremental false` 成功、`node --experimental-strip-types --test tests/mock-repository.test.mjs` 5件成功。NodeのMODULE_TYPELESS_PACKAGE_JSON警告あり。`git diff --check ef10b9f a89a916` 成功。

## 未実行

- ブラウザでの追加→反応→計画→訪問→終了→思い出の実操作、リロードをまたぐ確認、キーボード操作、360px・390pxの表示は未確認。
- Next.js dev serverはローカルで起動したが、この環境にはブラウザがなく実操作・HTTP確認は行わず停止した。
- coreから報告されたbuild成功と主要7ルートHTTP 200は未独立確認。テストはrepository単体。React画面と保存失敗表示は未実行。外部API／Supabase Authには接続していない。
- UIのaccessibility tree・スクリーンリーダーは未確認。
