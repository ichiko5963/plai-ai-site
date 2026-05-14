# Newsletter drafts

このディレクトリにメルマガ本文の HTML と TXT を置く。中身は `.gitignore` でローカル限定。

## 命名規則

```
YYYY-MM-slug.html
YYYY-MM-slug.txt
```

例: `2026-05-launch.html` / `2026-05-launch.txt`

## テンプレート差し込み

本文中 `{{name}}` は受信者氏名に置換される。

## 送信コマンド

```bash
# プレビュー（jiuhuot10@gmail.com に1通だけ）
node scripts/send-newsletter.js \
  --preview \
  --slug 2026-05-launch \
  --subject "【PLai】◯◯のお知らせ" \
  --html scripts/newsletters/2026-05-launch.html \
  --text scripts/newsletters/2026-05-launch.txt

# 本配信（consent_newsletter=1 全員）
node scripts/send-newsletter.js \
  --send-all \
  --slug 2026-05-launch \
  --subject "【PLai】◯◯のお知らせ" \
  --html scripts/newsletters/2026-05-launch.html \
  --text scripts/newsletters/2026-05-launch.txt
```

## 配信ログ確認

```bash
npx wrangler d1 execute plai-submissions --remote --command "SELECT campaign_slug, COUNT(*) AS n, MIN(sent_at) AS first_sent FROM newsletter_sends WHERE preview = 0 GROUP BY campaign_slug ORDER BY first_sent DESC LIMIT 10;"
```
