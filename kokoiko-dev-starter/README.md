# ここいこ

「今度ここ行きたい」「これやりたい」を一緒に貯めて、実際のおでかけと思い出までつなげるアプリ。

## Product flow

行きたい・やりたい → リアクション → 計画 → おでかけ → 思い出

## Planned stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase
  - PostgreSQL
  - Auth
  - Storage
- Google Maps Platform / Places（導入フェーズで確定）

## Documents

- `AGENTS.md` - Codex向けの開発ルール
- `TASKS.md` - 開発ロードマップ
- `docs/product-spec.md` - プロダクト仕様
- `docs/development-flow.md` - Git/GitHub/Codexを使った開発手順
- `docs/architecture.md` - 技術構成・ディレクトリ方針
- `docs/data-model.md` - DB設計案
- `docs/ui-reference.md` - Stitch画像対応表
- `docs/codex-prompts.md` - Codexへの依頼テンプレート
- `docs/design/` - StitchのUI参考画像

## Important

`.env.local` はGitに追加しないこと。公開可能なテンプレートだけ `.env.example` に置く。
