import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const result = { input: '', slug: '', title: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--slug') result.slug = argv[++i] ?? '';
    else if (value === '--title') result.title = argv[++i] ?? '';
    else if (!result.input) result.input = value;
  }
  return result;
}

function toSlug(input) {
  return input
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imported-docx';
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function xmlText(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell', ['-NoProfile', '-Command', command], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `PowerShell exited with code ${code}`));
    });
  });
}

function parseRelationships(xml) {
  const map = new Map();
  const regex = /<Relationship\b([^>]+)>/g;
  for (const match of xml.matchAll(regex)) {
    const attrs = match[1];
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, target.replace(/^media\//, ''));
  }
  return map;
}

function paragraphToMarkdown(paragraph, relationships, copiedImages) {
  const style = paragraph.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] ?? '';
  const isList = /<w:numPr>/.test(paragraph);
  const text = [...paragraph.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)].map((match) => xmlText(match[1])).join('');
  const images = [...paragraph.matchAll(/r:embed="([^"]+)"/g)].map((match) => match[1]);
  const lines = [];

  if (text.trim()) {
    if (/Heading1/i.test(style)) lines.push(`## ${text.trim()}`);
    else if (/Heading2/i.test(style)) lines.push(`### ${text.trim()}`);
    else if (isList) lines.push(`- ${text.trim()}`);
    else lines.push(text.trim());
  }

  for (const relId of images) {
    const filename = relationships.get(relId);
    const copied = filename ? copiedImages.get(filename) : '';
    if (copied) lines.push(`![DOCX 图片](./${copied})`);
  }

  return lines.join('\n\n');
}

function tablesToMarkdown(xml) {
  const tables = [];
  for (const table of xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/gs)) {
    const rows = [];
    for (const row of table[1].matchAll(/<w:tr>(.*?)<\/w:tr>/gs)) {
      const cells = [];
      for (const cell of row[1].matchAll(/<w:tc>(.*?)<\/w:tc>/gs)) {
        const text = [...cell[1].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)].map((match) => xmlText(match[1])).join('');
        cells.push(text.trim() || ' ');
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) {
      const width = Math.max(...rows.map((row) => row.length));
      const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill(' ')]);
      tables.push([
        `| ${normalized[0].join(' | ')} |`,
        `| ${Array(width).fill('---').join(' | ')} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`)
      ].join('\n'));
    }
  }
  return tables;
}

async function copyImages(unpackedDir, postDir) {
  const mediaDir = path.join(unpackedDir, 'word', 'media');
  const copied = new Map();
  try {
    const images = await fs.readdir(mediaDir);
    let index = 0;
    for (const image of images) {
      index += 1;
      const extension = path.extname(image) || '.png';
      const filename = `docx-image-${String(index).padStart(2, '0')}${extension.toLowerCase()}`;
      await fs.copyFile(path.join(mediaDir, image), path.join(postDir, filename));
      copied.set(image, filename);
    }
  } catch {
    return copied;
  }
  return copied;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.error('Usage: npm run import:docx -- <file.docx> --slug <slug> [--title <title>]');
  process.exit(1);
}

const absoluteInput = path.resolve(args.input);
const slug = args.slug || toSlug(path.basename(absoluteInput));
const title = args.title || path.basename(absoluteInput).replace(/\.[^.]+$/, '');
const postDir = path.resolve('content/posts', slug);
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'null-observatory-docx-'));

await fs.mkdir(postDir, { recursive: true });
await runPowerShell(`Expand-Archive -LiteralPath ${JSON.stringify(absoluteInput)} -DestinationPath ${JSON.stringify(tempDir)} -Force`);

const documentXml = await fs.readFile(path.join(tempDir, 'word', 'document.xml'), 'utf8');
let relsXml = '';
try {
  relsXml = await fs.readFile(path.join(tempDir, 'word', '_rels', 'document.xml.rels'), 'utf8');
} catch {
  relsXml = '';
}

const relationships = parseRelationships(relsXml);
const copiedImages = await copyImages(tempDir, postDir);
const tables = tablesToMarkdown(documentXml);
const paragraphs = [...documentXml.matchAll(/<w:p\b[^>]*>(.*?)<\/w:p>/gs)]
  .map((match) => paragraphToMarkdown(match[1], relationships, copiedImages))
  .filter(Boolean);

const today = new Date().toISOString().slice(0, 10);
const body = `---
title: ${yamlString(title)}
date: ${today}
category: "技术"
tags: ["DOCX", "写作"]
summary: ${yamlString(`从 ${path.basename(absoluteInput)} 导入的文章，图片已抽取到同名目录。`)}
source: "docx"
---

${[...paragraphs, ...tables].join('\n\n')}
`;

await fs.writeFile(path.join(postDir, 'index.md'), body, 'utf8');
await fs.rm(tempDir, { recursive: true, force: true });

console.log(`Imported ${absoluteInput}`);
console.log(`Post: ${path.join(postDir, 'index.md')}`);
