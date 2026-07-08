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

上传页支持 Markdown、DOCX、PDF 和图片。默认只需要选择文章文件并输入上传密码；标题、slug、分类、标签和摘要都在“文章信息（可选）”里，不填时会自动使用文件名和默认分类。

网页端可以自动处理 Markdown 里的 `data:image/...` 内嵌图片和公网图片地址；如果 Markdown 引用的是 `C:\...`、`D:\...`、`file://...` 这类本机路径，请使用下面的“本机智能导入”，因为浏览器不能直接读取你电脑里的任意本地文件。

PDF 上传后会先保存为 `content/posts/<slug>/source.pdf`，GitHub Actions 会用 `scripts/import-pdf.py` 提取文字和嵌入图片，生成 `index.md` 和 `pdf-image-*.png/jpg` 等图片文件，再部署到 Cloudflare Pages。

Markdown 网页上传时会自动扫描正文图片引用：
- `data:image/...` 内嵌图片会被自动提取成同目录图片文件。
- `https://...` 或 `http://...` 公网图片会由服务端下载并转存成同目录图片文件。
- 已手动选择的图片仍会按文件名匹配并把正文引用改成 `./图片名`。
- 本机绝对路径不能由网页自动读取，请用 `npm run publish:md`。

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

## 管理文章

管理页：

```text
https://null-observatory.pages.dev/manage/
```

使用同一个上传密码登录。管理页支持：
- 归档：给文章 frontmatter 写入 `archived: true`，文章会从首页、标签页、分类页和搜索索引隐藏，但仍保留在归档页和文章直达链接。
- 取消归档：移除隐藏效果，文章重新进入首页和索引。
- 删除：从 GitHub 仓库删除 `content/posts/<slug>/` 下的文章文件和图片，并触发 GitHub Actions 自动部署。

## Markdown 文章

## 本机智能导入 Markdown

当 Markdown 里包含本机缓存图片、Typora/WPS/浏览器缓存路径、相对图片路径或 `file://` 图片时，直接运行：

```bash
npm run publish:md -- "D:\文档\XXE.md" --slug xxe --title "XXE漏洞" --category "安全" --tags "XXE,Web,CTF" --summary "XXE 漏洞记录"
```

这个命令会自动完成：
- 读取 Markdown 正文。
- 找出 `![](...)` 和 `<img src="...">` 里的图片。
- 复制本机绝对路径、相对路径、`file://` 图片。
- 下载公网图片，提取 `data:image/...` 内嵌图片。
- 把正文图片引用统一改成 `./图片名`。
- 写入 `content/posts/<slug>/index.md`，运行构建，并提交推送到 GitHub 触发 Cloudflare Pages 部署。

如果只想先导入到本地检查，不推送发布：

```bash
npm run import:md -- "D:\文档\XXE.md" --slug xxe
```

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

## PDF 导入

网页上传 PDF 后会自动转换。也可以本机运行：

```bash
npm run import:pdf -- ./draft.pdf --slug my-pdf --title "文章标题"
```

脚本会生成：

```text
content/posts/my-pdf/index.md
content/posts/my-pdf/pdf-image-01.png
```

PDF 支持提取可选择文本和嵌入图片。扫描版 PDF 如果没有文字层，正文可能只剩图片；这种情况需要先 OCR 后再上传。

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
