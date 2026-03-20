#!/bin/bash
cd "$(dirname "$0")"
echo "正在部署到 Cloudflare Pages..."
npx wrangler pages deploy . --project-name my-device-control-web --branch main
echo "部署完成！"
echo "网站地址: https://my-device-control-web.pages.dev"
