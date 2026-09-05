# Git / GitHub / VS Code / Codex 開発手順

この文書はGitに慣れていない人でも、変更を安全に確認しながら開発するための手順。

---

# 0. 用語

## Git

PC上で「いつ、何を変更したか」を履歴として保存する仕組み。

## GitHub

Gitの履歴をインターネット上に保存・共有するサービス。

## repository（リポジトリ）

プロジェクト一式とGitの履歴をまとめたもの。

## commit

その時点の変更を1つの履歴として保存すること。

## branch

mainとは別の作業用の枝。

## push

PC上のcommitをGitHubへ送ること。

## Pull Request（PR）

「このbranchの変更をmainへ入れてよいか」を確認する場所。

## merge

確認済みbranchをmainへ取り込むこと。

---

# 1. 最初の一回だけ行うセットアップ

## 1-1. 必要なもの

- GitHubアカウント
- Git
- Node.jsの現行LTS
- VS Code
- OpenAI Codex IDE拡張またはCodex CLI
- Supabaseアカウント（Phase 2で必要）

GitとNode.jsが入っているかターミナルで確認：

```bash
git --version
node --version
npm --version
```

バージョン番号が出れば基本OK。

---

# 2. GitHubに空リポジトリを作る

GitHubでNew repositoryを選び、例として以下にする。

- Repository name: `kokoiko`
- Visibility: Privateを推奨

ローカルで新しいアプリを作るため、GitHub側でREADMEや.gitignoreを先に生成しない方が手順が単純。

---

# 3. Next.js + Supabaseプロジェクトを作る

Supabase公式のNext.jsテンプレートを利用する方法が簡単。

```bash
npx create-next-app@latest kokoiko -e with-supabase
cd kokoiko
```

このテンプレートはNext.js、TypeScript、Tailwind CSS、Supabase向け構成をまとめて用意する。

作成後：

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、初期画面が出ることを確認する。

停止はターミナルで `Ctrl + C`。

---

# 4. このスターター資料をコピーする

`kokoiko-dev-starter` の以下を、新しく作った `kokoiko` フォルダへコピーする。

- `AGENTS.md`
- `TASKS.md`
- `docs/`
- `.github/`

READMEや.gitignore、.env.exampleはcreate-next-app側にも存在することがあるため、内容を確認して統合する。

特に `.gitignore` から `.env.local` を除外する設定を消さないこと。

---

# 5. VS Codeで開く

プロジェクトフォルダ内から：

```bash
code .
```

またはVS Code → File → Open Folder → `kokoiko` を選択。

Codex IDE拡張を開いてChatGPTアカウントでサインインする。

---

# 6. GitHubへ最初のpush

現在の状態確認：

```bash
git status
```

初回commit：

```bash
git add .
git commit -m "chore: initialize kokoiko project"
```

GitHubのリポジトリ画面に表示されるremote設定を行う。通常は以下の形：

```bash
git remote add origin <GitHubに表示されたリポジトリURL>
git branch -M main
git push -u origin main
```

GitHubを開き、ファイルが表示されれば完了。

---

# 7. ここから毎回行う開発サイクル

ここが最重要。

## Step A: mainを最新にする

```bash
git switch main
git pull
```

## Step B: 作業branchを作る

例：ホームUIを作る場合。

```bash
git switch -c feat/home-ui
```

現在branch確認：

```bash
git branch --show-current
```

`feat/home-ui` と出ればOK。

## Step C: Codexへ1つの仕事だけ頼む

例：

```text
AGENTS.mdと関連docsを読んでください。
docs/design/01-home.pngを参考に、ホーム画面をモックデータで実装してください。
今回はSupabase接続は行わないでください。
実装後にlintとbuildを確認し、私がブラウザで確認する項目を教えてください。
```

## Step D: Codexの変更を確認

まずGitで変更一覧を見る。

```bash
git status
git diff
```

VS CodeのSource Control画面でも確認できる。

「Codexが言ったから正しい」とせず、変更ファイルが想定範囲かを見る。

## Step E: ブラウザで触る

```bash
npm run dev
```

確認例：

- 見た目
- ボタンを押せるか
- ページ遷移
- 戻る操作
- スクロール
- スマートフォン幅
- エラーが出ないか

Chrome DevToolsのDevice Toolbar等を使いスマホ幅でも確認する。

## Step F: 問題があれば同じbranchで修正

Codexへ具体的に伝える。

悪い例：

`なんか変`

良い例：

`390px幅で、下部ナビが最後のカードに重なっています。デザインは変えず、下端の余白だけ調整してください。`

再度自分で確認する。

## Step G: commitする

変更に納得したら：

```bash
git add .
git commit -m "feat: add home screen"
```

commitは「自分がOKを出したチェックポイント」。

## Step H: GitHubへpush

```bash
git push -u origin feat/home-ui
```

## Step I: Pull Requestを作る

GitHubで `feat/home-ui` → `main` のPull Requestを作る。

PRでは：

- Files changed
- 変更概要
- 自分の確認手順
- スクリーンショット

を見る。

一人開発でもPRを使うことで「mainへ入れる前の最終確認場所」ができる。

## Step J: mainへmerge

問題なければMerge Pull Request。

## Step K: ローカルmainも更新

```bash
git switch main
git pull
```

不要になったローカルbranchを消す場合：

```bash
git branch -d feat/home-ui
```

これで1タスク完了。

---

# 8. つまり毎回この繰り返し

```text
mainを最新にする
↓
branchを作る
↓
Codexへ小さなタスクを頼む
↓
差分を見る
↓
自分でブラウザ確認
↓
必要なら修正
↓
commit
↓
push
↓
Pull Request
↓
最終確認
↓
merge
↓
mainをpull
```

---

# 9. 開発順序

最初からDB、地図、写真APIまで全部つなげない。

## 第1段階：触れる模型

Stitchの見た目をモックデータで実装。

目標：

「本物のデータは入っていないが、アプリを一通り触れる」

この段階でUXの違和感を発見する。

## 第2段階：Supabase

- ログイン
- グループ
- 行きたい場所
- やりたいこと

から実データ化。

## 第3段階：共同機能

- リアクション
- コメント

## 第4段階：外部API

- 地図
- Places
- 写真

## 第5段階：おでかけ

- 計画
- カレンダー
- 記念日

## 第6段階：思い出

- 写真アップロード
- アルバム

---

# 10. Gitで怖くなったとき

まずこれだけ実行：

```bash
git status
```

何が起きているか確認する。

分からない場合、CodexやChatGPTへ `git status` の結果を貼って相談する。

よく分からないまま以下を実行しない：

- `git reset --hard`
- `git clean -fd`
- `git push --force`

これらは変更や履歴を消す可能性がある。

---

# 11. Codexに任せるもの / 自分で判断するもの

## Codexに任せやすい

- コンポーネント実装
- 型定義
- DB migration作成
- テスト作成
- lintエラー修正
- リファクタリング
- バグ原因調査

## 自分で必ず確認

- UIが本当に使いやすいか
- 仕様として欲しい動きか
- Stitchとのズレを許容できるか
- 機能を増やすべきか
- API料金を払ってまで必要か
- mainへ入れてよい品質か

---

# 12. 最初の具体的な実装順

おすすめ：

1. 共通アプリ枠 + 下部ナビ
2. ホーム
3. 行きたい一覧
4. スポット詳細
5. 追加画面
6. おでかけ一覧・計画
7. カレンダー
8. 思い出一覧・詳細
9. グループ画面
10. ここまで触ってUXを再評価
11. Supabase接続開始

一度に18画面をCodexへ頼まない。

---

# 13. 完了の基準

「Codexがコードを書いた」では完了ではない。

以下を満たして初めて完了：

- 意図した画面・機能になった
- 自分で操作した
- エラーがない
- lint/buildが通る
- 差分を確認した
- commitした
- Pull Requestでmainとの差分を確認した
- mainへmergeした
