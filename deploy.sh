#!/bin/bash
cd "$(dirname "$0")"

echo "正在部署到 Cloudflare Pages (含前端页面 + API Functions)..."
npx wrangler pages deploy . --project-name my-device-control-web --branch main --commit-dirty=true

echo "部署完成！"
echo "网页地址: https://my-device-control-web.pages.dev/index-miaoda.html"
echo "API 地址: https://my-device-control-web.pages.dev/api"
