const sidebar = document.querySelector('[data-sidebar]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const overlay = document.querySelector('[data-search-overlay]');
const searchInput = document.querySelector('[data-search-input]');
const searchResults = document.querySelector('[data-search-results]');
let searchIndex = [];

menuToggle?.addEventListener('click', () => {
  sidebar?.classList.toggle('is-open');
});

function openSearch() {
  if (!overlay) return;
  overlay.hidden = false;
  document.body.classList.add('searching');
  window.setTimeout(() => searchInput?.focus(), 20);
}

function closeSearch() {
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove('searching');
}

async function loadSearch() {
  if (searchIndex.length) return searchIndex;
  const response = await fetch('/search.json');
  searchIndex = await response.json();
  return searchIndex;
}

function renderResults(query) {
  if (!searchResults) return;
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    searchResults.innerHTML = '<p class="empty-search">输入关键词后开始检索。</p>';
    return;
  }
  const results = searchIndex
    .filter((item) => `${item.title} ${item.summary} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(normalized))
    .slice(0, 8);
  searchResults.innerHTML = results.length
    ? results.map((item) => `<a href="${item.url}"><b>${item.title}</b><span>${item.summary}</span></a>`).join('')
    : '<p class="empty-search">没有找到匹配文章。</p>';
}

document.querySelectorAll('[data-search-open]').forEach((button) => {
  button.addEventListener('click', async () => {
    openSearch();
    await loadSearch();
    renderResults(searchInput?.value ?? '');
  });
});

document.querySelector('[data-search-close]')?.addEventListener('click', closeSearch);
overlay?.addEventListener('click', (event) => {
  if (event.target === overlay) closeSearch();
});

searchInput?.addEventListener('input', () => renderResults(searchInput.value));

document.addEventListener('keydown', async (event) => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
    event.preventDefault();
    openSearch();
    await loadSearch();
    renderResults(searchInput?.value ?? '');
  }
  if (event.key === 'Escape') closeSearch();
});

const progress = document.querySelector('[data-reading-progress]');
if (progress) {
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
}

const uploadForm = document.querySelector('[data-upload-form]');
if (uploadForm) {
  const articleInput = uploadForm.querySelector('input[name="article"]');
  const imagesInput = uploadForm.querySelector('input[name="images"]');
  const imageFolderInput = uploadForm.querySelector('[data-image-folder]');
  const pickImageDir = uploadForm.querySelector('[data-pick-image-dir]');
  const articleLabel = uploadForm.querySelector('[data-article-file]');
  const imagesLabel = uploadForm.querySelector('[data-image-files]');
  const imageReport = uploadForm.querySelector('[data-image-report]');
  const output = uploadForm.querySelector('[data-upload-output]');
  const submit = uploadForm.querySelector('.upload-submit');
  let folderImages = [];

  const imageTypes = new Map([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['webp', 'image/webp'],
    ['svg', 'image/svg+xml'],
    ['avif', 'image/avif']
  ]);

  function extFromType(type) {
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/svg+xml') return 'svg';
    return type?.startsWith('image/') ? type.split('/')[1] : 'png';
  }

  function cleanUploadName(name, fallback = 'image.png') {
    return (name || fallback)
      .split(/[\\/]/)
      .pop()
      .replace(/[\u0000-\u001f<>:"|?*]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 120) || fallback;
  }

  function imageBasename(src) {
    const clean = decodeURIComponent(String(src).split(/[?#]/)[0]).replaceAll('\\', '/');
    return cleanUploadName(clean.split('/').pop() || '');
  }

  function markdownImageRefs(markdown) {
    const refs = [];
    for (const match of markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
      refs.push({ raw: match[0], src: match[1].trim().replace(/^<|>$/g, '') });
    }
    for (const match of markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      refs.push({ raw: match[0], src: match[1].trim() });
    }
    return refs;
  }

  function dataImageToFile(src, index) {
    const match = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) return null;
    const type = match[1].toLowerCase();
    const extension = extFromType(type);
    const binary = atob(match[2].replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], `embedded-image-${String(index).padStart(2, '0')}.${extension}`, { type });
  }

  function imageLookup(files) {
    const map = new Map();
    for (const file of files) {
      const names = [file.name, file.webkitRelativePath].filter(Boolean);
      for (const name of names) {
        const base = imageBasename(name);
        if (base && !map.has(base.toLowerCase())) map.set(base.toLowerCase(), file);
      }
    }
    return map;
  }

  async function prepareMarkdownUpload(formData) {
    const article = articleInput.files?.[0];
    if (!article || !/\.m(?:d|arkdown)$/i.test(article.name)) return;
    let markdown = await article.text();
    const refs = markdownImageRefs(markdown);
    if (!refs.length) {
      imageReport.textContent = '未在 Markdown 中发现图片引用。';
      return;
    }

    const manualImages = [...(imagesInput.files ?? [])];
    const lookup = imageLookup([...manualImages, ...folderImages]);
    const uploadImages = new Map(manualImages.map((file) => [file.name.toLowerCase(), file]));
    const missing = [];
    let embeddedCount = 0;

    for (const ref of refs) {
      if (/^https?:\/\//i.test(ref.src)) continue;
      let file = null;
      if (/^data:image\//i.test(ref.src)) {
        embeddedCount += 1;
        file = dataImageToFile(ref.src, embeddedCount);
      } else if (!ref.src.startsWith('/')) {
        file = lookup.get(imageBasename(ref.src).toLowerCase()) ?? null;
      }
      if (!file) {
        if (!ref.src.startsWith('/') && !/^https?:\/\//i.test(ref.src)) missing.push(ref.src);
        continue;
      }
      const name = cleanUploadName(file.name);
      uploadImages.set(name.toLowerCase(), file.name === name ? file : new File([file], name, { type: file.type }));
      markdown = markdown.split(ref.src).join(`./${name}`);
    }

    formData.delete('article');
    formData.delete('images');
    formData.append('article', new File([markdown], cleanUploadName(article.name), { type: article.type || 'text/markdown' }));
    for (const file of uploadImages.values()) formData.append('images', file);

    const matched = uploadImages.size;
    imageReport.textContent = missing.length
      ? `已匹配 ${matched} 张图片，仍有 ${missing.length} 个本地路径未找到。`
      : `已匹配 ${matched} 张图片，Markdown 引用已自动改为同目录图片。`;
  }

  articleInput?.addEventListener('change', () => {
    articleLabel.textContent = articleInput.files?.[0]?.name || '选择 Markdown 或 DOCX';
    imageReport.textContent = 'Markdown 图片会在提交前自动扫描；内嵌 base64 图片会自动提取。';
  });

  imagesInput?.addEventListener('change', () => {
    const count = imagesInput.files?.length ?? 0;
    imagesLabel.textContent = count ? `已选择 ${count} 张图片` : '可多选与 Markdown 同目录的图片';
  });

  pickImageDir?.addEventListener('click', () => {
    imageFolderInput?.click();
  });

  imageFolderInput?.addEventListener('change', () => {
    folderImages = [...(imageFolderInput.files ?? [])].filter((file) => file.type.startsWith('image/'));
    imageReport.textContent = folderImages.length ? `已读取目录中的 ${folderImages.length} 张图片，提交时会按 Markdown 文件名自动匹配。` : '未在目录中读取到图片。';
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    const password = formData.get('password');
    formData.delete('password');
    formData.delete('imageFolder');
    output.textContent = '正在上传到观测站...';
    submit.disabled = true;

    try {
      await prepareMarkdownUpload(formData);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-blog-upload-password': password
        },
        body: formData
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || '上传失败。');
      }
      output.textContent = `${result.message} slug: ${result.slug}`;
      uploadForm.reset();
      folderImages = [];
      articleLabel.textContent = '选择 Markdown 或 DOCX';
      imagesLabel.textContent = '可多选与 Markdown 同目录的图片';
      imageReport.textContent = 'Markdown 图片会在提交前自动扫描；内嵌 base64 图片会自动提取。';
    } catch (error) {
      output.textContent = error.message || '上传失败。';
    } finally {
      submit.disabled = false;
    }
  });
}
