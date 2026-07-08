import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = process.cwd();
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (['push', 'no-build'].includes(key)) {
      args[key] = true;
    } else {
      args[key] = argv[index + 1];
      index += 1;
    }
  }
  return args;
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

function yamlString(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function hasFrontmatter(markdown) {
  return /^---\s*[\r\n]/.test(markdown);
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

function uniqueName(name, used) {
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

function resolveImagePath(src, markdownDir) {
  if (/^file:\/\//i.test(src)) return fileURLToPath(src);
  if (/^[a-z]:[\\/]/i.test(src) || src.startsWith('\\\\')) return src;
  if (path.isAbsolute(src)) return src;
  return path.resolve(markdownDir, src.replaceAll('/', path.sep));
}

async function copyLocalImage(src, markdownDir, postDir, used) {
  const imagePath = resolveImagePath(decodeURIComponent(src), markdownDir);
  const stat = await fs.stat(imagePath);
  if (!stat.isFile()) throw new Error(`图片不是文件：${src}`);
  const name = uniqueName(path.basename(imagePath), used);
  await fs.copyFile(imagePath, path.join(postDir, name));
  return name;
}

async function writeDataImage(src, postDir, used, index) {
  const match = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new Error('无法识别内嵌图片。');
  const name = uniqueName(`embedded-image-${String(index).padStart(2, '0')}${mediaExtension(match[1], '')}`, used);
  await fs.writeFile(path.join(postDir, name), Buffer.from(match[2].replace(/\s/g, ''), 'base64'));
  return name;
}

async function downloadRemoteImage(src, postDir, used) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`远程图片下载失败：${src}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`远程地址不是图片：${src}`);
  const url = new URL(src);
  const fallback = cleanFilename(path.basename(url.pathname)) || 'remote-image';
  const name = uniqueName(`${fallback.replace(/\.[^.]+$/, '')}${mediaExtension(type, fallback)}`, used);
  await fs.writeFile(path.join(postDir, name), Buffer.from(await response.arrayBuffer()));
  return name;
}

function frontmatter({ title, date, category, tags, summary }) {
  return `---\ntitle: ${yamlString(title)}\ndate: ${date}\ncategory: ${yamlString(category)}\ntags: [${tags.map(yamlString).join(', ')}]\nsummary: ${yamlString(summary)}\nsource: "markdown"\n---\n\n`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args._[0];
  if (!source) {
    throw new Error('用法：npm run import:md -- "<file.md>" --slug my-post --title "标题"');
  }

  const sourcePath = path.resolve(source);
  const markdownDir = path.dirname(sourcePath);
  const raw = await fs.readFile(sourcePath, 'utf8');
  const slug = toSlug(args.slug || args.title || path.basename(sourcePath));
  const postDir = path.join(root, 'content', 'posts', slug);
  const metadata = {
    title: String(args.title || path.basename(sourcePath, path.extname(sourcePath))),
    date: String(args.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    category: String(args.category || '技术'),
    tags: String(args.tags || 'Markdown').split(',').map((tag) => tag.trim()).filter(Boolean),
    summary: String(args.summary || '')
  };

  await fs.mkdir(postDir, { recursive: true });
  const used = new Set(['index.md']);
  let markdown = raw.replace(/^\uFEFF/, '');
  let embeddedIndex = 0;
  const imported = [];
  const missing = [];

  for (const src of markdownImageRefs(markdown)) {
    if (/^#/i.test(src)) continue;
    try {
      let name = null;
      if (/^data:image\//i.test(src)) {
        embeddedIndex += 1;
        name = await writeDataImage(src, postDir, used, embeddedIndex);
      } else if (/^https?:\/\//i.test(src)) {
        name = await downloadRemoteImage(src, postDir, used);
      } else {
        name = await copyLocalImage(src, markdownDir, postDir, used);
      }
      markdown = markdown.split(src).join(`./${name}`);
      imported.push(`${src} -> ${name}`);
    } catch (error) {
      missing.push(`${src} (${error.message})`);
    }
  }

  if (missing.length) {
    throw new Error(`有 ${missing.length} 张图片无法导入：\n${missing.slice(0, 10).join('\n')}`);
  }

  const body = hasFrontmatter(markdown) ? markdown : `${frontmatter(metadata)}${markdown}`;
  await fs.writeFile(path.join(postDir, 'index.md'), body, 'utf8');

  console.log(`Imported ${slug}`);
  console.log(`Images: ${imported.length}`);
  for (const item of imported) console.log(`- ${item}`);

  if (!args['no-build']) await run('npm', ['run', 'build']);
  if (args.push) {
    await run('git', ['add', `content/posts/${slug}`]);
    await run('git', ['commit', '-m', `Upload post: ${metadata.title}`]);
    await run('git', ['push', 'origin', 'main']);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
