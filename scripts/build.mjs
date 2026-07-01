import fs from 'node:fs/promises';
import path from 'node:path';
import { site } from '../src/data/site.js';
import { categories, escapeHtml, formatDate, loadPosts, tags, years } from './content.mjs';
import './sync-post-assets.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

async function copyDir(source, destination) {
  try {
    const entries = await fs.readdir(source, { withFileTypes: true });
    await fs.mkdir(destination, { recursive: true });
    for (const entry of entries) {
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      if (entry.isDirectory()) await copyDir(from, to);
      else await fs.copyFile(from, to);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writePage(route, html) {
  const output = path.join(dist, route, 'index.html');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html, 'utf8');
}

function enc(value) {
  return encodeURIComponent(value);
}

function layout({ title = site.name, description = site.description, content, posts, pageClass = '' }) {
  const pageTitle = title === site.name ? site.name : `${title} · ${site.name}`;
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#061015">
    <link rel="icon" href="/favicon.svg">
    <link rel="stylesheet" href="/styles/global.css">
    <title>${escapeHtml(pageTitle)}</title>
  </head>
  <body class="${escapeHtml(pageClass)}">
    <div class="stars" aria-hidden="true"></div>
    <div class="grid-horizon" aria-hidden="true"></div>
    <div class="site-shell">
      ${sidebar(posts)}
      <main class="main-panel" id="content">
        ${topbar()}
        ${content}
      </main>
    </div>
    ${searchOverlay()}
    <script src="/scripts/site.js" defer></script>
  </body>
</html>`;
}

function topbar() {
  return `<header class="topbar">
    <button class="icon-button menu-toggle" data-menu-toggle aria-label="打开导航"><span></span><span></span><span></span></button>
    <a class="crumb" href="/">/ 首页</a>
    <div class="topbar-actions">
      <button class="icon-button" data-search-open aria-label="搜索文章">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"/></svg>
      </button>
      <a class="icon-button" href="/archive/" aria-label="文章归档">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M5 7l1.2 12h11.6L19 7M9 11h6M10 3h4l1 4H9l1-4Z"/></svg>
      </a>
    </div>
  </header>`;
}

function sidebar(posts) {
  const categoryList = categories(posts);
  const tagList = tags(posts);
  const navIcons = ['home', 'archive', 'tag', 'upload', 'info'];
  return `<aside class="sidebar" data-sidebar>
    <a class="brand" href="/" aria-label="${escapeHtml(site.name)}"><span class="brand-mark" aria-hidden="true"></span><span>${escapeHtml(site.name)}</span></a>
    <section class="identity">
      <div class="orbit-avatar" aria-hidden="true"><span></span></div>
      <h1>${escapeHtml(site.author)}</h1>
      <p>${escapeHtml(site.description)}</p>
      <div class="status-line"><span></span><b>ONLINE</b></div>
    </section>
    <section class="counts" aria-label="站点统计">
      <div><span>文章</span><b>${posts.length}</b></div>
      <div><span>分类</span><b>${categoryList.length}</b></div>
      <div><span>标签</span><b>${tagList.length}</b></div>
      <div><span>运行</span><b>128天</b></div>
    </section>
    <nav class="side-nav" aria-label="主导航">
      ${site.nav.map((item, index) => `<a href="${item.href}"><span class="nav-glyph nav-${navIcons[index]}" aria-hidden="true"></span>${escapeHtml(item.label)}</a>`).join('')}
    </nav>
    <button class="side-search" data-search-open>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"/></svg>
      <span>搜索文章</span><kbd>/</kbd>
    </button>
    <section class="side-widget">
      <h2>分类</h2>
      <ul class="category-list">${categoryList.map(([category, count]) => `<li><a href="/categories/${enc(category)}/">${escapeHtml(category)}</a><span>${count}</span></li>`).join('')}</ul>
    </section>
    <section class="side-widget">
      <h2>标签云</h2>
      <div class="tag-cloud">${tagList.slice(0, 16).map(([tag]) => `<a href="/tags/${enc(tag)}/">${escapeHtml(tag)}</a>`).join('')}</div>
    </section>
    <footer class="side-footer">
      <div class="status-table"><span>Observatory</span><b>Nominal</b><span>Transmission</span><b>Stable</b><span>Signal</span><b>Clear</b></div>
      <p>© 2026 ${escapeHtml(site.name)}</p>
    </footer>
  </aside>`;
}

function searchOverlay() {
  return `<div class="search-overlay" data-search-overlay hidden>
    <div class="search-dialog" role="dialog" aria-modal="true" aria-label="搜索文章">
      <div class="search-dialog-head">
        <input data-search-input type="search" placeholder="搜索文章" autocomplete="off">
        <button class="icon-button" data-search-close aria-label="关闭搜索">×</button>
      </div>
      <div class="search-results" data-search-results></div>
    </div>
  </div>`;
}

function postFeed(posts) {
  return `<section class="post-feed" aria-label="文章列表">
    ${posts.map((post, index) => `<article class="post-row">
      <div class="post-timeline"><span></span></div>
      <div class="post-meta"><time datetime="${post.date}">${formatDate(post.date)}</time><a href="/categories/${enc(post.category)}/">${escapeHtml(post.category)}</a><span>${post.readingMinutes} 分钟阅读</span></div>
      <a class="post-main" href="/posts/${post.slug}/"><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.summary)}</p></a>
      <a class="post-arrow" href="/posts/${post.slug}/" aria-label="阅读 ${escapeHtml(post.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg></a>
      <span class="post-index">[${String(index + 1).padStart(2, '0')}]</span>
    </article>`).join('')}
  </section>`;
}

function home(posts) {
  return `<section class="home-intro"><p>观测站日志</p><h1>在低温光里整理网络、文档与硬件笔记。</h1></section>${postFeed(posts)}`;
}

function article(post) {
  return `<div class="reading-progress" data-reading-progress aria-hidden="true"></div>
  <article class="article-shell">
    <header class="article-head">
      <h1>${escapeHtml(post.title)}</h1>
      <div class="article-meta"><time datetime="${post.date}">${formatDate(post.date)}</time><span>${escapeHtml(post.category)}</span><span>${post.tags.map(escapeHtml).join(' · ')}</span><span>${post.readingMinutes} 分钟阅读</span></div>
      ${post.cover ? `<img class="article-cover" src="${post.cover}" alt="" loading="eager">` : ''}
    </header>
    <div class="article-grid">
      <div class="article-body">${post.html}</div>
      <aside class="toc-rail" aria-label="文章目录">
        <h2>文章目录</h2>
        ${post.toc.length ? `<nav>${post.toc.map((item) => `<a class="toc-depth-${item.depth}" href="#${item.id}">${escapeHtml(item.text)}</a>`).join('')}</nav>` : '<p>暂无目录</p>'}
        <div class="related-tags">${post.tags.map((tag) => `<a href="/tags/${enc(tag)}/">${escapeHtml(tag)}</a>`).join('')}</div>
        <a class="backtop" href="#content">回到顶部</a>
      </aside>
    </div>
  </article>`;
}

function archive(posts) {
  return `<section class="listing-page"><h1>文章归档</h1>${years(posts).map(([year, items]) => `<section class="archive-year"><h2>${year}</h2><div>${items.map((post) => `<a class="archive-item" href="/posts/${post.slug}/"><time datetime="${post.date}">${formatDate(post.date)}</time><span>${escapeHtml(post.title)}</span><b>${escapeHtml(post.category)}</b></a>`).join('')}</div></section>`).join('')}</section>`;
}

function tagIndex(posts) {
  return `<section class="listing-page"><h1>标签</h1><div class="index-cloud">${tags(posts).map(([tag, count]) => `<a href="/tags/${enc(tag)}/">${escapeHtml(tag)}<span>${count}</span></a>`).join('')}</div></section>`;
}

function about() {
  return `<section class="about-page"><h1>${escapeHtml(site.name)}</h1><p>这里是 Huonawo 的冷静观测站，用来存放技术笔记、文档处理流程、硬件记录和生活日志。首版内容均可替换，真实文章只需要按约定放入 <code>content/posts</code>。</p><div class="about-grid"><section><h2>内容格式</h2><p>支持带图片的 Markdown，同篇图片放在文章同名目录。DOCX 可通过导入脚本转换为可发布文章。</p></section><section><h2>部署方式</h2><p>站点构建为静态文件，经 GitHub 保存代码，并发布到 Cloudflare Pages 与自定义域名。</p></section></div></section>`;
}

function upload() {
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="upload-page">
    <header class="upload-head">
      <p>CONTENT UPLINK</p>
      <h1>上传文章</h1>
    </header>
    <form class="upload-form" data-upload-form>
      <div class="upload-grid">
        <label><span>文章标题</span><input name="title" type="text" required placeholder="例如：夜间网络观测"></label>
        <label><span>文章 Slug</span><input name="slug" type="text" placeholder="night-network-notes"></label>
        <label><span>日期</span><input name="date" type="date" value="${today}"></label>
        <label><span>分类</span><input name="category" type="text" value="技术"></label>
      </div>
      <label><span>标签</span><input name="tags" type="text" placeholder="Markdown, 笔记, 网络"></label>
      <label><span>摘要</span><textarea name="summary" rows="3" placeholder="首页文章流显示的简短摘要"></textarea></label>
      <label><span>上传密码</span><input name="password" type="password" autocomplete="current-password" required></label>
      <label class="file-drop"><span>文章文件</span><input name="article" type="file" accept=".md,.markdown,.docx" required><b data-article-file>选择 Markdown 或 DOCX</b></label>
      <label class="file-drop"><span>Markdown 图片</span><input name="images" type="file" accept="image/*" multiple><b data-image-files>可多选与 Markdown 同目录的图片</b></label>
      <div class="upload-tools">
        <button type="button" data-pick-image-dir>选择图片目录匹配</button>
        <input data-image-folder type="file" accept="image/*" webkitdirectory multiple hidden>
        <p data-image-report>Markdown 图片会在提交前自动扫描；内嵌 base64 图片会自动提取。</p>
      </div>
      <button class="upload-submit" type="submit">提交上传</button>
      <output class="upload-output" data-upload-output>等待文件输入。</output>
    </form>
  </section>`;
}

async function build() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
  await copyDir(publicDir, dist);
  await fs.mkdir(path.join(dist, 'styles'), { recursive: true });
  await fs.copyFile(path.join(root, 'src/styles/global.css'), path.join(dist, 'styles/global.css'));

  const posts = await loadPosts();
  await writePage('', layout({ content: home(posts), posts }));
  await writePage('archive', layout({ title: '归档', content: archive(posts), posts }));
  await writePage('tags', layout({ title: '标签', content: tagIndex(posts), posts }));
  await writePage('upload', layout({ title: '上传', content: upload(), posts }));
  await writePage('about', layout({ title: '关于', content: about(), posts }));

  for (const post of posts) {
    await writePage(path.join('posts', post.slug), layout({ title: post.title, description: post.summary, content: article(post), posts, pageClass: 'article-page' }));
  }
  for (const [tag] of tags(posts)) {
    const matching = posts.filter((post) => post.tags.includes(tag));
    await writePage(path.join('tags', tag), layout({ title: `标签：${tag}`, content: `<section class="home-intro compact"><p>标签</p><h1>${escapeHtml(tag)}</h1></section>${postFeed(matching)}`, posts }));
  }
  for (const [category] of categories(posts)) {
    const matching = posts.filter((post) => post.category === category);
    await writePage(path.join('categories', category), layout({ title: `分类：${category}`, content: `<section class="home-intro compact"><p>分类</p><h1>${escapeHtml(category)}</h1></section>${postFeed(matching)}`, posts }));
  }

  await fs.writeFile(path.join(dist, 'search.json'), JSON.stringify(posts.map((post) => ({
    title: post.title,
    summary: post.summary,
    category: post.category,
    tags: post.tags,
    date: post.date,
    url: `/posts/${post.slug}/`
  }))), 'utf8');
  await fs.copyFile(path.join(root, 'src/worker.js'), path.join(dist, '_worker.js'));

  console.log(`Built ${posts.length} posts into ${dist}`);
}

await build();

if (process.argv.includes('--watch')) {
  console.log('Watching content, src, and public. Press Ctrl+C to stop.');
  const watcher = fs.watch(root, { recursive: true });
  for await (const event of watcher) {
    if (event.filename?.includes('node_modules') || event.filename?.startsWith('dist')) continue;
    console.log(`Change detected: ${event.filename}`);
    await build();
  }
}
