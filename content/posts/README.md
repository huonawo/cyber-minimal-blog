# 文章放这里

每篇文章新建一个目录：

```text
content/posts/<slug>/index.md
content/posts/<slug>/cover.png
content/posts/<slug>/image.png
```

正文里的图片用相对路径引用：

```markdown
![图片说明](./image.png)
```

DOCX 可以用导入命令生成文章目录：

```bash
npm run import:docx -- ./draft.docx --slug my-draft --title "文章标题"
```

线上上传页：

```text
https://null-observatory.pages.dev/upload/
```
