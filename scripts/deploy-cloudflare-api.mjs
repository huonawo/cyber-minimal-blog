import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'dd9814678000cc220e9e234afc937e8d';
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'null-observatory';
const branch = process.env.CLOUDFLARE_PAGES_BRANCH || 'main';
const directory = path.resolve(process.env.CLOUDFLARE_PAGES_DIST || 'dist');
const apiBase = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.error('CLOUDFLARE_API_TOKEN is required.');
  process.exit(1);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8']
]);

async function cf(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.success === false) {
    const message = data.errors?.map((error) => error.message).join('; ') || response.statusText || text;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data.result ?? data;
}

async function ensureProject() {
  try {
    return await cf(`/accounts/${accountId}/pages/projects/${projectName}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    return await cf(`/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName,
        production_branch: branch
      })
    });
  }
}

async function walk(dir, base = dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, base, files);
    } else {
      const relative = path.relative(base, absolute).split(path.sep).join('/');
      const buffer = await fs.readFile(absolute);
      const extension = path.extname(relative).toLowerCase();
      files.push({
        relative,
        absolute,
        buffer,
        contentType: contentTypes.get(extension) || 'application/octet-stream',
        hash: crypto.createHash('md5').update(buffer).update(extension).digest('hex')
      });
    }
  }
  return files;
}

async function uploadAssets(files, jwt) {
  const check = await fetch(`${apiBase}/pages/assets/check-missing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ hashes: files.map((file) => file.hash) })
  });
  const missing = check.ok ? await check.json() : { result: files.map((file) => file.hash) };
  const missingHashes = new Set(missing.result ?? files.map((file) => file.hash));
  const toUpload = files.filter((file) => missingHashes.has(file.hash));

  for (let index = 0; index < toUpload.length; index += 50) {
    const chunk = toUpload.slice(index, index + 50);
    const payload = chunk.map((file) => ({
      key: file.hash,
      value: file.buffer.toString('base64'),
      metadata: { contentType: file.contentType },
      base64: true
    }));
    const upload = await fetch(`${apiBase}/pages/assets/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify(payload)
    });
    if (!upload.ok) {
      throw new Error(`Asset upload failed: ${upload.status} ${await upload.text()}`);
    }
  }

  await fetch(`${apiBase}/pages/assets/upsert-hashes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ hashes: files.map((file) => file.hash) })
  });

  return Object.fromEntries(files.map((file) => [`/${file.relative}`, file.hash]));
}

await ensureProject();
const { jwt } = await cf(`/accounts/${accountId}/pages/projects/${projectName}/upload-token`);
const files = await walk(directory);
const manifest = await uploadAssets(files, jwt);
const formData = new FormData();
formData.append('manifest', JSON.stringify(manifest));
formData.append('branch', branch);
formData.append('commit_message', 'Deploy Null Observatory');

const deployment = await fetch(`${apiBase}/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
const deploymentBody = await deployment.json();
if (!deployment.ok || deploymentBody.success === false) {
  throw new Error(deploymentBody.errors?.map((error) => error.message).join('; ') || deployment.statusText);
}

console.log(`Deployed ${files.length} files to Cloudflare Pages project ${projectName}.`);
console.log(deploymentBody.result?.url || deploymentBody.result?.aliases?.[0] || '');
