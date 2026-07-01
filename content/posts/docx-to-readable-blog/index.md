---
title: "把 DOCX 转成可读的博客文章"
date: 2025-05-04
category: "技术"
tags: ["DOCX", "写作", "Markdown"]
summary: "把 Word 文档转换为结构清晰、适合发布的 Markdown：清洗样式、处理图片，最后让内容真正可读。"
cover: "./cover.png"
source: "markdown"
---

很多内容最初都在 Word 里完成：需求文档、技术方案，甚至是随手记录的想法。但直接复制到博客里，格式混乱、图片丢失、样式不可控。我的目标是：把 DOCX 转成干净、结构化、适合阅读的 Markdown。

## 输入格式

博客默认使用这样的文章目录：

```text
content/posts/docx-to-readable-blog/
├── index.md
├── cover.png
└── pipeline.png
```

正文中的图片只需要写相对路径：

```markdown
![DOCX 导入流程](./pipeline.png)
```

构建前脚本会把图片同步到公开资源目录，并把页面里的图片地址转换成可访问路径。

## 图片处理

DOCX 里的图片通常是嵌入式的，且尺寸、命名和对齐方式都不可控。导入脚本会采用统一策略：抽取图片、生成稳定文件名、放入同名文章目录，再在正文中引用。

![DOCX 导入流程](./pipeline.png)

> 一致的输出结构，才能让后续发布流程稳定可靠。

## 部署流程

整个工具链是一条短链路：输入 DOCX，输出 Markdown 与静态资源，随后由 Astro 构建为静态站点，再发布到 Cloudflare Pages。

```ts
import mammoth from 'mammoth';

const result = await mammoth.convertToHtml({
  path: 'draft.docx'
});
```

首版不会尝试还原 Word 的复杂版式，而是优先保留语义：标题、段落、列表、表格、图片和引用。这比像素级复刻更适合博客阅读。
