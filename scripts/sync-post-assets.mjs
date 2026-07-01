import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const postsDir = path.join(root, 'content/posts');
const publicDir = path.join(root, 'public/post-assets');
const ignored = new Set(['index.md', 'index.mdx']);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (ignored.has(entry.name) || entry.name.endsWith('.docx')) continue;
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

if (await exists(postsDir)) {
  await fs.rm(publicDir, { recursive: true, force: true });
  await fs.mkdir(publicDir, { recursive: true });
  const posts = await fs.readdir(postsDir, { withFileTypes: true });
  for (const post of posts) {
    if (!post.isDirectory()) continue;
    await copyDir(path.join(postsDir, post.name), path.join(publicDir, post.name));
  }
}
