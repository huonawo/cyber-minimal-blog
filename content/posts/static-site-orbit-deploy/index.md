---
title: "一次静态站点的轨道部署"
date: 2025-05-11
category: "技术"
tags: ["部署", "Cloudflare", "GitHub"]
summary: "把静态站点送进轨道并不复杂。本文记录使用 GitHub 与 Cloudflare Pages 完成构建到部署的全流程。"
source: "markdown"
---

## 构建

静态博客的核心优势是边界清晰：内容在仓库，构建在 CI 或本机，访问由 CDN 承载。

## 发布

Cloudflare Pages 会接收构建产物，并为每次部署生成可回滚版本。自定义域名绑定后，访问路径保持稳定。
