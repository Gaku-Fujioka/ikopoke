# REV-05: CORE-02 固定コミットの独立レビュー

- 基準: `d91af81`。対象: `d250a25`。
- 判定: 確認した固定差分に指摘なし。

## 優先確認

- 終了時のMemoryは、同一group/outingの `snapshot.visits` から `itemTitles` を作る。予定に含むだけで訪問記録がない候補は入らない。訪問0件なら空の候補一覧を持つMemoryになる。
- `recordVisit` は所属グループのoutingとitemを検索し、itemがplanの `itemIds` に含まれることを確認する。他groupのIDまたは計画外候補は拒否される。
- 同一outing・itemへの再送は既存Visitを返すため重複しない。終了操作も既存Memoryを返す。
- `load` は旧P1 snapshotに `visits` がない場合のみ `[]` を補い、その後現在のschema validatorで検査する。`d91af81` の `KokoikoSnapshot` にあったgroup/items/outings/memoriesの形は維持されており、旧snapshotを拒否する差分は見当たらない。

## 検証状況

- 固定差分と周辺の既存コード・要件を読み取り確認。coreの報告はlint、tsc、Node5テスト成功。レビュー側ではテストを再実行していない。
- ブラウザ、実DB、別グループの実認証環境は対象外。モック内のgroup ID検査は本番の認可境界ではない。
- テスト差分には旧snapshotから `visits` 欠落を埋める回帰fixtureがない。互換処理自体はコード上確認できたが、自動テストでの実行は未確認。
