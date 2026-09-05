# UI Reference

Stitchから出力された18画面を、開発で扱いやすい英数字ファイル名へ変更している。

| File | Screen | 主な実装フェーズ |
|---|---|---|
| `design/01-home.png` | ホーム | Phase 1 |
| `design/02-wishlist-list.png` | 行きたい一覧 | Phase 1 |
| `design/03-map.png` | 地図表示 | Phase 5 |
| `design/04-spot-detail.png` | スポット詳細 | Phase 1 / 3 |
| `design/05-add-item.png` | スポット・やりたいこと追加 | Phase 1 / 3 |
| `design/06-list-management.png` | リスト一覧・管理 | Phase 1 / 3 |
| `design/07-outings-list.png` | おでかけ一覧 | Phase 1 / 6 |
| `design/08-outing-plan.png` | おでかけ詳細・計画 | Phase 1 / 6 |
| `design/09-calendar.png` | カレンダー・日付詳細 | Phase 1 / 6 |
| `design/10-anniversary.png` | 記念日追加・設定 | Phase 1 / 6 |
| `design/11-outing-in-progress.png` | おでかけ中 | Phase 7 |
| `design/12-memories-list.png` | 思い出一覧 | Phase 1 / 7 |
| `design/13-memory-detail.png` | 思い出詳細 | Phase 1 / 7 |
| `design/14-memory-contents.png` | アルバム目次 | Phase 7 |
| `design/15-memory-chapter-1.png` | アルバム見開き1 | Phase 7 |
| `design/16-memory-chapter-3.png` | アルバム見開き3/エピローグ | Phase 7 |
| `design/17-group-switcher.png` | グループ切り替え | Phase 1 / 2 |
| `design/18-group-settings.png` | グループ設定 | Phase 1 / 2 |

## Codexへの伝え方

例：

`docs/design/01-home.png をUI参考にしてホーム画面を実装してください。まずモックデータで作り、DB接続はまだしないでください。`

複数画面を一度に渡しすぎず、1〜2画面単位で進める。

## 注意

Stitch画像は「参考設計」であって絶対仕様ではない。
実際に触った際の使いやすさ、実装上の一貫性、アクセシビリティを優先して調整してよい。
