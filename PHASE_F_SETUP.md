# Phase F — メアド収集システム セットアップ手順

シングルオプトインで `email / name / company / position / gift_type / source_path` を D1 に保存し、後で CSV エクスポートできる仕組み。**メール送信は行わない**（後で必要になったら MailChannels を追加できる構成）。

## 全体像

```
ユーザー操作（gift card クリック / article gate）
   ↓
gift-modal.js が開く（js/gift-modal.js）
   ↓
POST /api/subscribe → Cloudflare Pages Function（functions/api/subscribe.js）
   ↓
D1 (plai-submissions テーブル) に INSERT
   ↓
レスポンスでクライアントを unlock（articleなら gate を非表示・vaultなら deck を開く）
   ↓
管理者側: GET /api/export?token=XXX&format=csv で CSV ダウンロード
```

## 1. D1 データベースの作成（初回のみ）

ローカルに wrangler がインストール済みの前提（`npm i -g wrangler` または `npx wrangler`）。

```bash
cd plai-new-site

# Cloudflare アカウントにログイン
wrangler login

# D1 データベースを作成（一度だけ）
wrangler d1 create plai-submissions
```

実行すると `database_id = "xxxx-xxxx-..."` が返ってくる。これを `wrangler.toml` の `database_id` に貼り付ける。

## 2. wrangler.toml を更新

```toml
[[d1_databases]]
binding = "DB"
database_name = "plai-submissions"
database_id = "REPLACE_WITH_D1_DATABASE_ID_FROM_DASHBOARD"  # ← ここに貼る
migrations_dir = "migrations"
```

## 3. スキーマ適用（migrate）

```bash
# ローカル D1（開発用）に適用
wrangler d1 migrations apply plai-submissions --local

# 本番 D1 に適用
wrangler d1 migrations apply plai-submissions --remote
```

`migrations/0001_init.sql` が submissions テーブルを作成する。

## 4. Cloudflare Pages 側の D1 binding 設定

Cloudflare Dashboard → Pages → `plai-ai-site` プロジェクト → Settings → Functions → **D1 database bindings** で、

| Variable name | D1 database |
|---|---|
| `DB` | `plai-submissions` |

を本番（Production）と Preview の両方に追加。

## 5. EXPORT_TOKEN（CSV エクスポート用秘密トークン）の設定

Cloudflare Dashboard → Pages → `plai-ai-site` → Settings → Environment variables → **Production** に：

| Variable name | Value | Type |
|---|---|---|
| `EXPORT_TOKEN` | `(ランダムな長い文字列。例: 32文字以上)` | **Encrypted** |

トークン生成例：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 6. デプロイ確認

```bash
git add .
git commit -m "feat: D1 + Pages Functions for email collection"
git push origin main
```

Cloudflare Pages が自動デプロイ。30〜60秒後に有効化。

## 7. 動作確認

### ブラウザでテスト
1. `https://plai-ai.com/` にアクセス
2. ページ下部の「GIFT 01 — Vaultテンプレを受け取る」ボタンをクリック
3. モーダルが開く → 4項目入力 → 送信
4. 新規タブで `decks/obsidian-vault-template.html` が開く

### CSV エクスポート
```
https://plai-ai.com/api/export?token=YOUR_EXPORT_TOKEN&format=csv
```

ブラウザでアクセスするか、curl で：
```bash
curl "https://plai-ai.com/api/export?token=YOUR_TOKEN&format=csv" -o submissions.csv
```

JSON 形式が欲しい場合：
```
?format=json
```

### D1 を直接 SQL で確認
```bash
wrangler d1 execute plai-submissions --remote --command "SELECT id, email, name, gift_type, created_at FROM submissions ORDER BY created_at DESC LIMIT 20"
```

## ファイル構成

```
plai-new-site/
├── wrangler.toml                  # D1 binding 設定（database_id を貼る）
├── migrations/
│   └── 0001_init.sql              # submissions テーブル定義
├── functions/
│   └── api/
│       ├── subscribe.js           # POST /api/subscribe（送信受け取り）
│       └── export.js              # GET /api/export（CSV/JSON ダウンロード）
├── js/
│   └── gift-modal.js              # 再利用可能なモーダル
├── css/style.css                  # .gift-section / .gift-modal / .article-gate スタイル
├── decks/
│   └── obsidian-vault-template.html  # Vault テンプレ デッキ（32枚）
└── PHASE_F_SETUP.md               # 本ファイル
```

## トラブルシュート

### モーダルは出るが /api/subscribe が 404
→ Cloudflare Pages の Functions が有効になっているか確認。Dashboard で「Functions」タブが見えれば OK。

### POST するが db_error が返る
→ `wrangler.toml` の `database_id` が正しいか、Dashboard 側で `DB` という binding 名で本番にバインドされているか確認。

### 「forbidden」と返る（/api/export）
→ `EXPORT_TOKEN` がProduction環境に正しく設定されているか、URL の `?token=` 値が一致しているか確認。

### localStorage に状態が残って何度もテストできない
→ DevTools → Application → Local Storage → `plai_gift_unlocked` を削除して再テスト。

## 後で追加する場合

### メール送信を追加するなら
`functions/api/subscribe.js` の最後に MailChannels HTTP API（`https://api.mailchannels.net/tx/v1/send`）を fetch で叩く処理を追加。確認メールを送りたいなら専用エンドポイントを別途追加。

### ダブルオプトインに切り替える
- subscribe.js で `confirmed_at` カラムを追加 + 確認トークン生成 + メールリンク送信
- 別エンドポイント `/api/confirm?token=XXX` で `confirmed_at` を更新
- gift-modal.js のレスポンス分岐を「確認メール送信済み」表示に
