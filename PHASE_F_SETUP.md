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

### メール送信（実装済み・Resend経由）

> **2024年8月でMailChannels無料Workers統合は廃止**されたため、**Resend** に切替。
> 無料枠 3,000通/月。送信ドメイン未認証なら `onboarding@resend.dev` から送信可。

`functions/api/subscribe.js` は Resend HTTP API（`https://api.resend.com/emails`）を呼んで、フォーム送信完了時に **PDF ダウンロードリンク + 無料相談 CTA** を含むメールを自動配信する。

#### Resend セットアップ（必須）

1. **アカウント作成**: https://resend.com にアクセスして無料登録（メアド or GitHub）
2. **API key 発行**: ログイン後 → API Keys → Create API Key（権限: Sending access）→ `re_xxxxxx` をコピー
3. **Cloudflare Pages secret に登録**:
```bash
cd plai-new-site
echo "re_YOUR_API_KEY_HERE" | npx wrangler pages secret put RESEND_API_KEY --project-name=plai-ai-site
```
4. **（任意）独自ドメイン認証**: より良いブランディング+送信制限緩和のため
   - Resend ダッシュボード → Domains → Add Domain → `plai-ai.com`
   - Resendが表示するDKIM/SPFレコードをCloudflare DNSに追加
   - 認証完了後、Pages secret に `RESEND_FROM_VERIFIED=1` を追加
   - これで送信元が `noreply@plai-ai.com` に切替（未設定だと `onboarding@resend.dev`）

#### 配信内容

| gift_type | 件名 | 本文の主内容 |
|---|---|---|
| `obsidian_vault` | 【PLai】Obsidian Vault テンプレートをお届けします | PDF (19MB) + HTML版リンク + 無料相談ボタン |
| `article_continue` | 【PLai】記事の続き＆過去記事一覧をお届けします | 全3記事のWeb版+PDF版リンク（読んでた記事に ★） + 無料相談ボタン |

送信元: `noreply@plai-ai.com`（plai-ai.com 上の任意のローカルパート、実在不要）
返信先: `jiuhuot10@gmail.com`

#### MailChannels DNS設定（**必須・手動**）

Cloudflare Pages Functions から MailChannels API を使うには、DNS に 3 種類のレコードを追加する必要がある。
全て Cloudflare ダッシュボード → plai-ai.com → DNS → Records から追加できる。

##### ① ドメインロックダウン（必須・これがないと全部失敗）

| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `_mailchannels` | `v=mc1 cfid=f14850d872cc625d7dc3a2f7354c1256` | Auto |

これがないと `Domain Lockdown` エラーで送信不可。Cloudflare account_id は `f14850d872cc625d7dc3a2f7354c1256`（ダッシュボード URL に含まれる）。

##### ② SPF レコード（既存レコードがある場合は include を追加）

| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `@`（plai-ai.com） | `v=spf1 include:relay.mailchannels.net ~all` | Auto |

既に SPF レコードがある場合は、`include:relay.mailchannels.net` を含むよう更新する（複数 SPF レコードは作らない、1 つにまとめる）。

##### ③ DKIM（迷惑メールフォルダ回避のため強く推奨）

1. ローカルで秘密鍵・公開鍵を生成:
```bash
openssl genrsa 2048 | tee priv_key.pem | openssl rsa -outform der | openssl base64 -A > priv_key.txt
echo -n 'v=DKIM1;p=' > pub_key_record.txt
openssl rsa -in priv_key.pem -pubout -outform der | openssl base64 -A >> pub_key_record.txt
```

2. `pub_key_record.txt` の内容を DNS に追加:

| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `mailchannels._domainkey` | （`pub_key_record.txt` の中身） | Auto |

3. `priv_key.txt` の中身を Cloudflare Pages 環境変数に追加:

Dashboard → Pages → plai-ai-site → Settings → Environment variables → Production
- `DKIM_PRIVATE_KEY` = priv_key.txt の中身（Encrypted）
- `DKIM_DOMAIN` = `plai-ai.com`
- `DKIM_SELECTOR` = `mailchannels`

4. `functions/api/subscribe.js` 側で DKIM 署名を payload に追加（任意機能、未実装。要追加実装）。

> **最低限の運用**: ① _mailchannels TXT だけは必須。② SPF と ③ DKIM は迷惑メール対策。本番運用に入る前に全部設定推奨。

#### 動作確認

DNS 反映後（数分〜30分）、フォーム送信して受信箱を確認。
迷惑メールフォルダに入る場合は SPF/DKIM が未設定。

#### トラブルシュート
- `mailchannels_403: Domain Lockdown` → ① _mailchannels TXT が未設定 or 反映待ち
- メールが届かない → 迷惑メールフォルダ確認、SPF/DKIM 設定
- subscribe レスポンスに `email_sent: false` → MailChannels API エラー、`email_error` 詳細確認

### ダブルオプトインに切り替える
- subscribe.js で `confirmed_at` カラムを追加 + 確認トークン生成 + メールリンク送信
- 別エンドポイント `/api/confirm?token=XXX` で `confirmed_at` を更新
- gift-modal.js のレスポンス分岐を「確認メール送信済み」表示に

---

## お問い合わせフォーム（contact.html）

`contact.html` の問い合わせも D1 + Resend 構成で動く。フローは以下：

```
contact.html フォーム送信
   ↓ fetch POST application/json
/api/contact (functions/api/contact.js)
   ↓
D1 contacts テーブルへ INSERT
   ↓
Resend で jiuhuot10@gmail.com に通知メール (Reply-To = 問い合わせ者)
   ↓
問い合わせ者にお礼の自動返信メール
   ↓
管理者: GET /api/export?token=XXX&type=contacts&format=csv で一覧ダウンロード
```

### マイグレーション適用

```bash
cd plai-new-site

# ローカル D1 に適用（開発・テスト用）
npx wrangler d1 migrations apply plai-submissions --local

# 本番 D1 に適用 (0004_add_contacts.sql が走る)
npx wrangler d1 migrations apply plai-submissions --remote
```

### 必要な環境変数 (Cloudflare Pages → Settings → Environment variables → Production)

| Variable | 値 | 型 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxx`（subscribe で既に設定済みなら共用） | Encrypted |
| `RESEND_FROM_VERIFIED` | `1`（plai-ai.com を Resend で認証済みの場合）/ 未設定で `onboarding@resend.dev` 送信 | Plaintext |
| `EXPORT_TOKEN` | エクスポート用秘密トークン（既存と共用） | Encrypted |

### 問い合わせ一覧の取得

```bash
# CSV
curl "https://plai-ai.com/api/export?token=YOUR_TOKEN&type=contacts&format=csv" -o plai-contacts.csv

# JSON
curl "https://plai-ai.com/api/export?token=YOUR_TOKEN&type=contacts&format=json"

# D1 直接 SQL
npx wrangler d1 execute plai-submissions --remote \
  --command "SELECT id, name, company, email, created_at FROM contacts ORDER BY created_at DESC LIMIT 20"
```

### 動作確認チェックリスト

- [ ] `/contact.html` で送信 → ブラウザに「送信が完了しました」表示
- [ ] `jiuhuot10@gmail.com` に「【PLai HP】新規お問い合わせ: 名前 / 会社名」件名のメールが届く
- [ ] そのメールに「返信」するとフォーム入力者のメールアドレス宛に飛ぶ (Reply-To)
- [ ] 問い合わせ者にも「お問い合わせを受け付けました」自動返信が届く
- [ ] D1 `contacts` テーブルに 1 行追加されている

### トラブルシュート

- 送信ボタン押下後にエラー表示 → DevTools Network タブで `/api/contact` のレスポンスを確認
- `db_error` → `wrangler.toml` の `database_id` と Pages の D1 binding が一致しているか、`contacts` テーブルが migrate 済みか
- 通知メールが届かない → Resend ダッシュボード → Logs を確認 / `RESEND_API_KEY` が Production secret に登録されているか
- 迷惑メールに入る → Resend で `plai-ai.com` ドメイン認証 (DKIM/SPF) を済ませ、`RESEND_FROM_VERIFIED=1` を Production env var に設定
