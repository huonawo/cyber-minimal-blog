# 内容与部署说明

## 上传文章的位置

可以直接把文章文件放进仓库目录：

```text
content/posts/
```

在本机就是：

```text
F:\新建文件夹 (2)\content\posts
```

放好文章后运行 `npm run build` 检查，再运行 `npm run deploy` 发布到 Cloudflare Pages。

也可以打开线上上传页提交文章：

```text
https://null-observatory.pages.dev/upload/
```

上传页支持 Markdown、DOCX 和 Markdown 同目录图片。上传功能需要先在 Cloudflare Pages 环境变量里配置：

```text
BLOG_UPLOAD_PASSWORD=<上传页密码>
BLOG_GITHUB_TOKEN=<可写入 huonawo/cyber-minimal-blog 的 GitHub token>
```

`BLOG_GITHUB_TOKEN` 建议使用 GitHub fine-grained personal access token，只给 `huonawo/cyber-minimal-blog` 仓库的 `Contents: Read and write` 权限。

GitHub Actions 自动部署还需要在 GitHub 仓库 Secrets 中配置：

```text
CLOUDFLARE_API_TOKEN=<Cloudflare Pages 部署 token>
```

如果这个 GitHub Secret 缺失，上传的文章会进入 GitHub，但自动部署步骤会失败，需要补 Secret 后重新运行 Actions。

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

部署脚本使用 Wrangler 发布 `dist/`，这样 Cloudflare Pages 可以同时部署静态文件和上传 API。运行环境需要存在 `CLOUDFLARE_API_TOKEN`。Cloudflare Pages 项目名为 `null-observatory`，正式访问域名为 `https://null-observatory.pages.dev`。
