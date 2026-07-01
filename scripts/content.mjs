import fs from 'node:fs/promises';
import path from 'node:path';

const postsDir = path.resolve('content/posts');

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date));
}

export function postAssetUrl(slug, assetPath) {
  const clean = String(assetPath).replace(/^\.?\//, '').replaceAll('\\', '/');
  return `/post-assets/${slug}/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return [{}, raw];
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return [{}, raw];
  const yaml = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  const data = {};

  for (const line of yaml.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (value === 'true') data[key] = true;
    else if (value === 'false') data[key] = false;
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return [data, body];
}

function rewriteMarkdownAssets(slug, markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\((?!https?:|\/|#)([^)]+)\)/g, (_match, alt, src) => {
      return `![${alt}](${postAssetUrl(slug, src)})`;
    })
    .replace(/(<img\b[^>]*\bsrc=["'])(?!https?:|\/|#)([^"']+)(["'][^>]*>)/g, (_match, prefix, src, suffix) => {
      return `${prefix}${postAssetUrl(slug, src)}${suffix}`;
    });
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function estimateReading(text) {
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const words = cjk + latinWords;
  return { words, minutes: Math.max(1, Math.ceil(words / 420)) };
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const toc = [];
  let paragraph = [];
  let list = [];
  let code = null;
  let quote = [];
  let table = [];
  const usedIds = new Map();

  const nextId = (text) => {
    const base = slugify(text);
    const count = usedIds.get(base) ?? 0;
    usedIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item)}</p>`).join('')}</blockquote>`);
    quote = [];
  };
  const flushTable = () => {
    if (table.length < 2) {
      table = [];
      return;
    }
    const rows = table.map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
    const headers = rows[0];
    const body = rows.slice(2);
    blocks.push(`<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushTable();
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (code) {
      if (trimmed.startsWith('```')) {
        blocks.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }
    if (trimmed.startsWith('```')) {
      flushAll();
      code = { lines: [] };
      continue;
    }
    if (trimmed === '') {
      flushAll();
      continue;
    }
    const heading = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      const depth = heading[1].length;
      const text = heading[2].trim();
      const id = nextId(text);
      toc.push({ id, text, depth });
      blocks.push(`<h${depth} id="${id}">${inlineMarkdown(text)}</h${depth}>`);
      continue;
    }
    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushAll();
      blocks.push(`<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`);
      continue;
    }
    if (trimmed.startsWith('<')) {
      flushAll();
      blocks.push(trimmed);
      continue;
    }
    if (/^\|.+\|$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      table.push(trimmed);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      flushTable();
      list.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      flushTable();
      quote.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }
    flushList();
    flushQuote();
    flushTable();
    paragraph.push(trimmed);
  }

  if (code) blocks.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
  flushAll();
  return { html: blocks.join('\n'), toc };
}

export async function loadPosts({ includeDrafts = false } = {}) {
  try {
    await fs.access(postsDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  const posts = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const file = path.join(postsDir, slug, 'index.md');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const [frontmatter, body] = parseFrontmatter(raw);
      if (frontmatter.draft && !includeDrafts) continue;
      const rendered = markdownToHtml(rewriteMarkdownAssets(slug, body));
      const reading = estimateReading(`${frontmatter.title ?? ''} ${body}`);
      posts.push({
        slug,
        title: String(frontmatter.title ?? slug),
        date: String(frontmatter.date ?? '1970-01-01'),
        category: String(frontmatter.category ?? '未分类'),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
        summary: String(frontmatter.summary ?? ''),
        cover: frontmatter.cover ? (/^(https?:|\/)/.test(frontmatter.cover) ? frontmatter.cover : postAssetUrl(slug, frontmatter.cover)) : '',
        draft: Boolean(frontmatter.draft),
        source: String(frontmatter.source ?? 'markdown'),
        html: rendered.html,
        toc: rendered.toc,
        readingMinutes: reading.minutes,
        words: reading.words
      });
    } catch {
      continue;
    }
  }
  return posts.sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date)));
}

export function categories(posts) {
  const counts = new Map();
  for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function tags(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function years(posts) {
  const groups = new Map();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), post]);
  }
  return [...groups.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
}
