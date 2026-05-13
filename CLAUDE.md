# PLai 企業サイト (plai-ai.com)

## ホスティング

- **ドメイン**: plai-ai.com
- **ホスティング**: Cloudflare Pages（Free）
- **GitHubリポジトリ**: ichiko5963/plai-ai-site
- **自動デプロイ**: mainブランチへのpushで自動反映

## 技術構成

- 静的HTML/CSS/JS（フレームワークなし）
- ビルド不要（そのまま配信）
- .mp4はGitHub容量制限のため.gitignoreで除外

## 更新手順

1. HTML/CSS/JSファイルを編集
2. `git add` → `git commit` → `git push`
3. Cloudflare Pagesが自動で再デプロイ（数十秒）

## 注意事項

- OGP URLは `https://plai-ai.com/` に統一
- 100MB以上のファイルはGitHubにpushできないため、動画は別管理
- Cloudflareアカウント: Jiuhuot10@gmail.com
- ネームサーバー: adaline.ns.cloudflare.com / glen.ns.cloudflare.com
