# ここいこ 開発スタートガイド

このフォルダは、Google Stitchで作成したUI画像をもとに「ここいこ」を開発するための資料セットです。

## 最初にやること

1. GitHubで空のPrivateリポジトリ `kokoiko` を作る
2. ローカルPCでNext.js + Supabaseのプロジェクトを作る
3. このスターター内のファイルをプロジェクト直下へコピーする
4. VS Codeでプロジェクトを開く
5. Codexに `AGENTS.md` と `docs/` を読ませる
6. `TASKS.md` の上から1機能ずつ実装する

## 基本ルール

- `main` は「自分で動作確認できた状態」だけを置く
- 新機能ごとにブランチを作る
- Codexには一度に大きな機能を依頼しない
- 実装後は必ず自分でブラウザを操作する
- OKならcommit → push → Pull Request → merge
- APIキーやパスワードはGitHubへ絶対にcommitしない

詳しい手順は `docs/development-flow.md` を読むこと。
