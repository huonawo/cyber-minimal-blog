# Null Observatory

冷科幻极简个人博客，使用零依赖 Node 静态生成器构建，支持带图片的 Markdown 文章和 DOCX 导入。

线上地址：`https://null-observatory.pages.dev`

文章上传位置：`content/posts/`

线上上传页：`https://null-observatory.pages.dev/upload/`

## 常用命令

```bash
npm run dev
npm run build
npm run import:docx -- ./draft.docx --slug my-draft --title "文章标题"
npm run deploy
```

内容说明见 `docs/content-workflow.md`。
