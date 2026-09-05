# Architecture

## 1. 基本構成

```text
Browser
  ↓
Next.js
  ├─ UI / routing
  ├─ Server Components / Server Actions
  └─ Route Handlers（必要時）
  ↓
Supabase
  ├─ Auth
  ├─ PostgreSQL
  └─ Storage

External
  └─ Google Maps / Places
```

## 2. 推奨ディレクトリ案

実装が始まったらCodexと相談しながら調整してよい。

```text
app/
  (app)/
    page.tsx
    items/
    outings/
    memories/
    calendar/
  auth/
components/
  ui/
  layout/
  items/
  outings/
  memories/
lib/
  supabase/
  maps/
  utils/
types/
supabase/
  migrations/
docs/
```

## 3. フェーズ分離

### 最初

UIをモックデータで作る。

理由：
- Stitchとの見た目・導線確認が早い
- DB設計変更のコストを減らせる
- 実際に触って仕様変更しやすい

### 次

認証・グループ・itemsから順番にSupabaseへ置き換える。

### 最後

地図API、写真、通知など外部依存の大きい機能を追加する。

## 4. 状態管理

初期段階では大規模なグローバル状態管理ライブラリを導入しない。

- URLで持てる状態 → URL
- サーバーデータ → Supabase + Server Component等
- 一時UI状態 → React state

必要性が明確になってから追加ライブラリを検討する。

## 5. データアクセス

Supabaseアクセスを画面内に無秩序に散らさず、必要に応じて `lib/` やデータアクセス関数へ整理する。

クライアントから直接扱うデータはRLSによって保護する。

## 6. 画像

初期UIではダミー画像を利用可能。
実写真は後でGoogle Places PhotosまたはSupabase Storageに接続する。

## 7. デプロイ

ローカル開発 → GitHub → Preview Deploy → 本番、の順を想定。

ホスティングはNext.jsとの相性からVercelが第一候補だが、実装段階で最終決定する。
