const repoOwner = 'huonawo';
const repoName = 'cyber-minimal-blog';
const branch = 'main';
const maxUploadBytes = 24 * 1024 * 1024;

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function toSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${new Date().toISOString().slice(0, 10)}`;
}

function cleanFilename(name) {
  return String(name)
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f<>:"|?*]/g, '-')
    .replace(/\s+/g, '-')
    .trim()
    .slice(0, 120);
}

function extension(name) {
  const match = String(name).toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? '';
}

function imageBasename(src) {
  const clean = String(src).split(/[?#]/)[0].replaceAll('\\', '/');
  return cleanFilename(clean.split('/').pop() || '');
}

function yamlString(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parseTags(value) {
  return String(value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasFrontmatter(markdown) {
  return /^---\s*[\r\n]/.test(markdown);
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return {};
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return {};
  const data = {};
  const yaml = markdown.slice(3, end).trim();
  for (const line of yaml.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (value === 'true') data[key] = true;
    else if (value === 'false') data[key] = false;
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return data;
}

function setFrontmatterBoolean(markdown, key, value) {
  const line = `${key}: ${value ? 'true' : 'false'}`;
  if (!markdown.startsWith('---')) return `---\n${line}\n---\n\n${markdown}`;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return `---\n${line}\n---\n\n${markdown}`;
  const head = markdown.slice(0, end);
  const rest = markdown.slice(end);
  const regex = new RegExp(`^${key}:\\s*.*$`, 'm');
  if (regex.test(head)) return `${head.replace(regex, line)}${rest}`;
  return `${head}\n${line}${rest}`;
}

function frontmatter(metadata, source) {
  const tags = metadata.tags.map(yamlString).join(', ');
  return `---\ntitle: ${yamlString(metadata.title)}\ndate: ${metadata.date}\ncategory: ${yamlString(metadata.category)}\ntags: [${tags}]\nsummary: ${yamlString(metadata.summary)}\nsource: "${source}"\n---\n\n`;
}

function markdownImageRefs(markdown) {
  return [
    ...markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
    ...markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)
  ].map((match) => String(match[1]).trim().replace(/^<|>$/g, ''));
}

function mediaExtension(contentType, fallback) {
  if (contentType?.includes('jpeg')) return '.jpg';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('gif')) return '.gif';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('svg')) return '.svg';
  if (contentType?.includes('avif')) return '.avif';
  return imageExtensions.has(extension(fallback)) ? extension(fallback) : '.png';
}

function uniqueImageName(name, used) {
  const ext = extension(name) || '.png';
  const base = cleanFilename(name).replace(/\.[^.]+$/, '') || 'image';
  let candidate = `${base}${ext}`;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}${ext}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function dataUrlToBase64(src, used, index) {
  const match = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const name = uniqueImageName(`embedded-image-${String(index).padStart(2, '0')}${mediaExtension(match[1], '')}`, used);
  return { name, content: match[2].replace(/\s/g, ''), encoding: 'base64' };
}

async function fetchRemoteImage(src, used) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`远程图片下载失败：${src}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`远程地址不是图片：${src}`);
  const fallback = imageBasename(new URL(src).pathname) || 'remote-image';
  const name = uniqueImageName(`${fallback.replace(/\.[^.]+$/, '')}${mediaExtension(type, fallback)}`, used);
  return { name, content: await arrayBufferToBase64(await response.arrayBuffer()), encoding: 'base64' };
}

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function rewriteMarkdownImageRefs(markdown, images) {
  const used = new Set(images.map((image) => cleanFilename(image.name).toLowerCase()));
  const imageNames = new Map(images.map((image) => [cleanFilename(image.name).toLowerCase(), cleanFilename(image.name)]));
  const extraImages = [];
  let rewritten = markdown;
  let count = 0;
  let embeddedIndex = 0;
  const localMissing = [];

  for (const src of markdownImageRefs(markdown)) {
    if (/^#/i.test(src)) continue;
    let image = null;
    if (/^data:image\//i.test(src)) {
      embeddedIndex += 1;
      image = dataUrlToBase64(src, used, embeddedIndex);
    } else if (/^https?:\/\//i.test(src)) {
      image = await fetchRemoteImage(src, used);
    } else {
      const name = imageNames.get(imageBasename(src).toLowerCase());
      if (name) {
        rewritten = rewritten.split(src).join(`./${name}`);
        count += 1;
        continue;
      }
      localMissing.push(src);
      continue;
    }

    if (!image) continue;
    extraImages.push(image);
    rewritten = rewritten.split(src).join(`./${image.name}`);
    count += 1;
  }

  return { markdown: rewritten, count, extraImages, localMissing };
}

async function fileToBase64(file) {
  return arrayBufferToBase64(await file.arrayBuffer());
}

async function github(env, pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.BLOG_GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'null-observatory-upload',
      'x-github-api-version': '2022-11-28',
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    throw new Error(data.message || `GitHub API ${response.status}`);
  }
  return data;
}

function requireAdmin(request, env) {
  if (!env.BLOG_UPLOAD_PASSWORD) return json({ ok: false, message: '管理功能还未配置 BLOG_UPLOAD_PASSWORD。' }, 503);
  if (!env.BLOG_GITHUB_TOKEN) return json({ ok: false, message: '管理功能还未配置 BLOG_GITHUB_TOKEN。' }, 503);
  if ((request.headers.get('x-blog-upload-password') ?? '') !== env.BLOG_UPLOAD_PASSWORD) {
    return json({ ok: false, message: '密码不正确。' }, 401);
  }
  return null;
}

async function commitFiles(env, files, message) {
  const ref = await github(env, `/repos/${repoOwner}/${repoName}/git/ref/heads/${branch}`);
  const headSha = ref.object.sha;
  const head = await github(env, `/repos/${repoOwner}/${repoName}/git/commits/${headSha}`);
  const treeItems = [];

  for (const file of files) {
    const blob = await github(env, `/repos/${repoOwner}/${repoName}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: file.content,
        encoding: file.encoding
      })
    });
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
  }

  const tree = await github(env, `/repos/${repoOwner}/${repoName}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: head.tree.sha,
      tree: treeItems
    })
  });
  const commit = await github(env, `/repos/${repoOwner}/${repoName}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [headSha]
    })
  });
  await github(env, `/repos/${repoOwner}/${repoName}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha })
  });
  return commit;
}

async function commitTree(env, treeItems, message) {
  const ref = await github(env, `/repos/${repoOwner}/${repoName}/git/ref/heads/${branch}`);
  const headSha = ref.object.sha;
  const head = await github(env, `/repos/${repoOwner}/${repoName}/git/commits/${headSha}`);
  const tree = await github(env, `/repos/${repoOwner}/${repoName}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: head.tree.sha,
      tree: treeItems
    })
  });
  const commit = await github(env, `/repos/${repoOwner}/${repoName}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [headSha]
    })
  });
  await github(env, `/repos/${repoOwner}/${repoName}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha })
  });
  return commit;
}

async function readRepoFile(env, filePath) {
  const data = await github(env, `/repos/${repoOwner}/${repoName}/contents/${encodeURIComponent(filePath).replaceAll('%2F', '/')}?ref=${branch}`);
  const raw = atob(String(data.content ?? '').replace(/\s/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

async function listRepoPosts(env) {
  const tree = await github(env, `/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
  const indexFiles = (tree.tree ?? [])
    .filter((item) => item.type === 'blob' && /^content\/posts\/[^/]+\/index\.md$/.test(item.path))
    .map((item) => item.path)
    .sort();
  const posts = [];
  for (const filePath of indexFiles) {
    const markdown = await readRepoFile(env, filePath);
    const fm = parseFrontmatter(markdown);
    posts.push({
      slug: filePath.split('/')[2],
      title: String(fm.title ?? filePath.split('/')[2]),
      date: String(fm.date ?? ''),
      category: String(fm.category ?? '未分类'),
      draft: Boolean(fm.draft),
      archived: Boolean(fm.archived),
      path: filePath
    });
  }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
}

async function handleListPosts(request, env) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  return json({ ok: true, posts: await listRepoPosts(env) });
}

async function handleArchivePost(request, env, slug) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const archived = Boolean(body.archived);
  const filePath = `content/posts/${slug}/index.md`;
  const markdown = await readRepoFile(env, filePath);
  const updated = setFrontmatterBoolean(markdown, 'archived', archived);
  const blob = await github(env, `/repos/${repoOwner}/${repoName}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: updated, encoding: 'utf-8' })
  });
  const commit = await commitTree(env, [{
    path: filePath,
    mode: '100644',
    type: 'blob',
    sha: blob.sha
  }], `${archived ? 'Archive' : 'Unarchive'} post: ${slug}`);
  return json({ ok: true, slug, archived, commit: commit.sha });
}

async function handleDeletePost(request, env, slug) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const tree = await github(env, `/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
  const prefix = `content/posts/${slug}/`;
  const items = (tree.tree ?? []).filter((item) => item.type === 'blob' && item.path.startsWith(prefix));
  if (!items.length) return json({ ok: false, message: '文章不存在或已经删除。' }, 404);
  const commit = await commitTree(env, items.map((item) => ({
    path: item.path,
    mode: '100644',
    type: 'blob',
    sha: null
  })), `Delete post: ${slug}`);
  return json({ ok: true, slug, deleted: items.map((item) => item.path), commit: commit.sha });
}

async function handleUpload(request, env) {
  if (!env.BLOG_UPLOAD_PASSWORD) {
    return json({ ok: false, message: '上传功能还未配置 BLOG_UPLOAD_PASSWORD。' }, 503);
  }
  if (!env.BLOG_GITHUB_TOKEN) {
    return json({ ok: false, message: '上传功能还未配置 BLOG_GITHUB_TOKEN。' }, 503);
  }
  const provided = request.headers.get('x-blog-upload-password') ?? '';
  if (provided !== env.BLOG_UPLOAD_PASSWORD) {
    return json({ ok: false, message: '上传密码不正确。' }, 401);
  }

  const form = await request.formData();
  const article = form.get('article');
  if (!(article instanceof File) || article.size === 0) {
    return json({ ok: false, message: '请选择 Markdown 或 DOCX 文件。' }, 400);
  }
  const images = form.getAll('images').filter((file) => file instanceof File && file.size > 0);
  const totalSize = [article, ...images].reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxUploadBytes) {
    return json({ ok: false, message: '单次上传总大小不能超过 24MB。' }, 413);
  }

  const articleExt = extension(article.name);
  if (!['.md', '.markdown', '.docx', '.pdf'].includes(articleExt)) {
    return json({ ok: false, message: '文章文件只支持 .md、.markdown、.docx 或 .pdf。' }, 400);
  }

  const seenImageNames = new Set();
  for (const image of images) {
    const imageName = cleanFilename(image.name);
    if (!imageExtensions.has(extension(imageName))) {
      return json({ ok: false, message: `图片格式不支持：${image.name}` }, 400);
    }
    if (seenImageNames.has(imageName)) {
      return json({ ok: false, message: `图片文件名重复：${imageName}` }, 400);
    }
    seenImageNames.add(imageName);
  }

  const metadata = {
    title: String(form.get('title') || article.name.replace(/\.[^.]+$/, '')).trim(),
    slug: toSlug(form.get('slug') || form.get('title') || article.name),
    date: String(form.get('date') || new Date().toISOString().slice(0, 10)).slice(0, 10),
    category: String(form.get('category') || '技术').trim(),
    tags: parseTags(form.get('tags') || (articleExt === '.docx' ? 'DOCX, 写作' : articleExt === '.pdf' ? 'PDF, 写作' : 'Markdown')),
    summary: String(form.get('summary') || '').trim()
  };

  const basePath = `content/posts/${metadata.slug}`;
  const files = [];
  if (articleExt === '.docx' || articleExt === '.pdf') {
    const sourceName = articleExt === '.pdf' ? 'source.pdf' : 'source.docx';
    files.push({
      path: `${basePath}/${sourceName}`,
      content: await fileToBase64(article),
      encoding: 'base64'
    });
    files.push({
      path: `${basePath}/upload.json`,
      content: JSON.stringify(metadata, null, 2),
      encoding: 'utf-8'
    });
  } else {
    const raw = await article.text();
    const rewritten = await rewriteMarkdownImageRefs(raw, images);
    if (rewritten.localMissing.length) {
      return json({
        ok: false,
        message: 'Markdown 中包含本机图片路径，网页无法读取电脑本地文件。请在本机运行 npm run publish:md -- "<你的md路径>" 自动导入。',
        missing: rewritten.localMissing.slice(0, 8)
      }, 400);
    }
    const body = hasFrontmatter(rewritten.markdown) ? rewritten.markdown : `${frontmatter(metadata, 'markdown')}${rewritten.markdown}`;
    files.push({
      path: `${basePath}/index.md`,
      content: body,
      encoding: 'utf-8'
    });
    for (const image of images) {
      files.push({
        path: `${basePath}/${cleanFilename(image.name)}`,
        content: await fileToBase64(image),
        encoding: 'base64'
      });
    }
    for (const image of rewritten.extraImages) {
      files.push({
        path: `${basePath}/${image.name}`,
        content: image.content,
        encoding: image.encoding
      });
    }
  }

  const commit = await commitFiles(env, files, `Upload post: ${metadata.title}`);
  return json({
    ok: true,
    message: articleExt === '.docx' ? 'DOCX 已上传，GitHub Actions 会转换并部署。' : articleExt === '.pdf' ? 'PDF 已上传，GitHub Actions 会提取文字和图片后部署。' : 'Markdown 和图片已上传，GitHub Actions 会部署。',
    slug: metadata.slug,
    commit: commit.sha,
    files: files.map((file) => file.path)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/posts' && request.method === 'GET') {
      try {
        return await handleListPosts(request, env);
      } catch (error) {
        return json({ ok: false, message: error.message || '读取文章失败。' }, 500);
      }
    }
    const postAction = url.pathname.match(/^\/api\/posts\/([^/]+)\/(archive|delete)$/);
    if (postAction) {
      const slug = toSlug(decodeURIComponent(postAction[1]));
      try {
        if (postAction[2] === 'archive' && request.method === 'PATCH') return await handleArchivePost(request, env, slug);
        if (postAction[2] === 'delete' && request.method === 'DELETE') return await handleDeletePost(request, env, slug);
        return json({ ok: false, message: 'Method not allowed.' }, 405);
      } catch (error) {
        return json({ ok: false, message: error.message || '管理操作失败。' }, 500);
      }
    }
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        return await handleUpload(request, env);
      } catch (error) {
        return json({ ok: false, message: error.message || '上传失败。' }, 500);
      }
    }
    if (url.pathname === '/api/upload') {
      return json({ ok: false, message: 'Method not allowed.' }, 405);
    }
    return env.ASSETS.fetch(request);
  }
};
