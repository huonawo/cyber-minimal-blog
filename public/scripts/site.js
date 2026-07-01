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
  const articleLabel = uploadForm.querySelector('[data-article-file]');
  const imagesLabel = uploadForm.querySelector('[data-image-files]');
  const output = uploadForm.querySelector('[data-upload-output]');
  const submit = uploadForm.querySelector('.upload-submit');

  articleInput?.addEventListener('change', () => {
    articleLabel.textContent = articleInput.files?.[0]?.name || '选择 Markdown 或 DOCX';
  });

  imagesInput?.addEventListener('change', () => {
    const count = imagesInput.files?.length ?? 0;
    imagesLabel.textContent = count ? `已选择 ${count} 张图片` : '可多选与 Markdown 同目录的图片';
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    const password = formData.get('password');
    formData.delete('password');
    output.textContent = '正在上传到观测站...';
    submit.disabled = true;

    try {
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
      articleLabel.textContent = '选择 Markdown 或 DOCX';
      imagesLabel.textContent = '可多选与 Markdown 同目录的图片';
    } catch (error) {
      output.textContent = error.message || '上传失败。';
    } finally {
      submit.disabled = false;
    }
  });
}
