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
    .trim()
    .slice(0, 120);
}

function extension(name) {
  const match = String(name).toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? '';
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

function frontmatter(metadata, source) {
  const tags = metadata.tags.map(yamlString).join(', ');
  return `---\ntitle: ${yamlString(metadata.title)}\ndate: ${metadata.date}\ncategory: ${yamlString(metadata.category)}\ntags: [${tags}]\nsummary: ${yamlString(metadata.summary)}\nsource: "${source}"\n---\n\n`;
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
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
  if (!['.md', '.markdown', '.docx'].includes(articleExt)) {
    return json({ ok: false, message: '文章文件只支持 .md、.markdown 或 .docx。' }, 400);
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
    tags: parseTags(form.get('tags') || (articleExt === '.docx' ? 'DOCX, 写作' : 'Markdown')),
    summary: String(form.get('summary') || '').trim()
  };

  const basePath = `content/posts/${metadata.slug}`;
  const files = [];
  if (articleExt === '.docx') {
    files.push({
      path: `${basePath}/source.docx`,
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
    const body = hasFrontmatter(raw) ? raw : `${frontmatter(metadata, 'markdown')}${raw}`;
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
  }

  const commit = await commitFiles(env, files, `Upload post: ${metadata.title}`);
  return json({
    ok: true,
    message: articleExt === '.docx' ? 'DOCX 已上传，GitHub Actions 会转换并部署。' : 'Markdown 和图片已上传，GitHub Actions 会部署。',
    slug: metadata.slug,
    commit: commit.sha,
    files: files.map((file) => file.path)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
