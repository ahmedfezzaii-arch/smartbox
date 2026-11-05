# Smartbox website

Static website for GitHub Pages. News refreshes automatically every 6 hours.

## Publish

1. Create a public GitHub repository named `smartbox` and upload every file from this folder, including `.github` and `.nojekyll`.
2. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Open **Actions > Update news and deploy > Run workflow**.

The site will be at `https://YOUR-USERNAME.github.io/smartbox/`.
A custom domain can be added in **Settings > Pages**.

## Common changes

- **Prices and services:** edit `index.html`.
- **Refresh schedule:** edit `cron` in `.github/workflows/update-and-deploy.yml`.
- **News sources and filters:** edit the top of `scripts/update-news.mjs`.
- **Telegram link:** search all HTML files for `t.me/SmartTrading_IA`.

## Data

- Prices, charts, heatmap and calendar come from free TradingView widgets. Keep their TradingView branding.
- News stores only the headline, link, source, date and category, then sends readers to the publisher. Check each feed's terms for commercial use.
