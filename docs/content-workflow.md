# 内容与部署说明

## Markdown 文章

每篇文章使用一个同名目录：

```text
content/posts/<slug>/
├── index.md
├── cover.png
└── image.png
```

正文图片使用相对路径，例如：

```markdown
![说明文字](./image.png)
```

构建前会运行 `npm run sync:assets`，把图片同步到 `public/post-assets/<slug>/`，页面会自动引用公开路径。

## DOCX 导入

运行：

```bash
npm run import:docx -- ./draft.docx --slug my-draft --title "文章标题"
```

脚本会生成：

```text
content/posts/my-draft/index.md
content/posts/my-draft/docx-image-01.png
```

DOCX 支持标题、段落、列表、表格和内嵌图片。首版优先转换成适合博客阅读的语义结构，不追求还原 Word 的复杂版式。

## 部署

本地构建：

```bash
npm run build
```

部署到 Cloudflare Pages：

```bash
npm run deploy
```

部署脚本使用 Cloudflare API 直传 `dist/`，需要本机或 CI 中存在 `CLOUDFLARE_API_TOKEN`。Cloudflare Pages 项目名为 `null-observatory`，自定义域名为 `huonawo.cc.cd`。
