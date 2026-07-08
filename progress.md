## 2026-07-01 - Task: Null Observatory blog implementation
### What was done
- Created the Astro static blog foundation for the cold sci-fi minimal personal site.
- Added repository-driven Markdown content support with same-folder image assets and automatic public asset sync.
- Added DOCX import support that converts Word documents into publishable article content and extracts embedded images.
- Added sample posts, documentation, site configuration, and Cloudflare Pages configuration.

### Testing
- Pending: install dependencies, build, browser verification, GitHub push, Cloudflare deployment, and custom domain validation.

### Notes
- Changed files: initial project files under `src/`, `scripts/`, `content/`, `public/`, `docs/`, plus root config files.
- Rollback: delete the created project files or revert the first Git commit after repository initialization.

## 2026-07-01 - Task: Verify and simplify Null Observatory build pipeline
### What was done
- Replaced the dependency-heavy Astro prototype with a zero-dependency Node static generator after npm/pnpm installs repeatedly stalled in the local Windows workspace.
- Kept the planned public behavior: homepage, article pages, archive, tag/category pages, search index, same-folder Markdown image assets, and DOCX import.
- Fixed the search overlay default visibility issue and tightened responsive rules for narrow screens.

### Testing
- `npm run build` passed and generated 5 production posts into `dist/`.
- Local HTTP checks returned 200 for the homepage, DOCX article page, search index, cover image, and inline article image.
- Headless Chrome screenshots were inspected for desktop homepage, desktop article page, and mobile homepage.
- A temporary DOCX containing a heading, paragraph, list, table, and embedded image was imported; the generated Markdown, extracted image, article HTML, title, and image reference all verified true before cleanup.

### Notes
- Changed files: `package.json` now uses the zero-dependency Node generator scripts; `scripts/build.mjs`, `scripts/content.mjs`, and `scripts/import-docx.mjs` implement static generation and DOCX import; `src/styles/global.css` fixes overlay and responsive behavior; `src/data/site.js` stores editable site identity.
- Rollback: restore the previous Astro-based files from a prior commit, or remove the generated project files if rolling back before the first commit.

## 2026-07-01 - Task: Deploy Null Observatory to Cloudflare Pages
### What was done
- Deployed the production `dist/` build to Cloudflare Pages project `null-observatory`.
- Confirmed the GitHub remote repository is `https://github.com/huonawo/cyber-minimal-blog.git`.
- Added a zero-dependency Cloudflare API deployment script so `npm run deploy` can publish without relying on a stalled local package install.
- Confirmed the Pages custom domain entry for `huonawo.cc.cd` exists, but DNS verification remains pending because the current Cloudflare token has zone read permission only.

### Testing
- `npm run build` passed and generated 5 posts into `dist/`.
- `npm run deploy` passed and deployed 33 files to `https://12df9e9c.null-observatory.pages.dev`.
- HTTP checks returned 200 for the deployed homepage, DOCX article page, and `search.json` on the Pages preview domain.
- Cloudflare Pages domain status check returned `pending` with `CNAME record not set`; DNS record lookup failed because the token lacks DNS edit/read API permission for records.

### Notes
- Changed files: `package.json` switches `npm run deploy` to the Cloudflare API uploader; `scripts/deploy-cloudflare-api.mjs` uploads `dist/` files to Pages; `docs/content-workflow.md` documents the `CLOUDFLARE_API_TOKEN` requirement; `progress.md` records this deployment round.
- Rollback: revert the next Git commit for source changes, or use Cloudflare Pages deployment history to roll back from the `null-observatory` project dashboard.

## 2026-07-01 - Task: Switch to Cloudflare Pages default domain
### What was done
- Changed the site canonical domain from `https://huonawo.cc.cd` to `https://null-observatory.pages.dev`.
- Removed the pending `huonawo.cc.cd` custom domain binding from the Cloudflare Pages project.
- Added clear upload-location documentation so Markdown, DOCX, and article images can be placed in the correct repository folder.

### Testing
- `npm run build` passed and generated 5 posts into `dist/`.
- `npm run deploy` passed and deployed 33 files to Cloudflare Pages.
- HTTP checks returned 200 for `https://null-observatory.pages.dev/`, the DOCX sample article page, and `search.json`.
- Cloudflare Pages domain list returned an empty custom domain list after deleting `huonawo.cc.cd`.

### Notes
- Changed files: `src/data/site.js` updates the canonical site domain; `docs/content-workflow.md` documents the upload folder and Pages default domain; `README.md` lists the live URL and article upload location; `content/posts/README.md` marks the exact article folder convention; `progress.md` records this round.
- Rollback: revert the next Git commit and redeploy, or re-add `huonawo.cc.cd` in Cloudflare Pages custom domains if that hostname is needed later.

## 2026-07-01 - Task: Add protected article upload
### What was done
- Added a public `/upload/` page for Markdown, DOCX, and Markdown image uploads.
- Added a Cloudflare Pages Worker upload API at `/api/upload` that requires an upload password and commits uploaded article files to GitHub.
- Added GitHub Actions deployment automation so uploaded DOCX files can be converted before build and new content can be deployed to Cloudflare Pages.
- Switched deployment back to Wrangler so static assets and the Worker upload API are deployed together.

### Testing
- `node --check src/worker.js` and `node --check public/scripts/site.js` passed.
- `npm run build` passed and generated 5 posts plus `dist/_worker.js`.
- `npm run deploy` passed; Wrangler uploaded 34 files and compiled/deployed the Worker bundle.
- HTTP checks returned 200 for the live homepage, upload page, and DOCX sample article page.
- Posting to `/api/upload` without required Cloudflare environment variables returned 503 with a safe configuration error instead of accepting anonymous uploads.
- GitHub Actions was triggered by the upload feature commit; DOCX conversion and build steps succeeded, while the Cloudflare deployment step failed until the repository `CLOUDFLARE_API_TOKEN` Secret is configured.

### Notes
- Changed files: `src/data/site.js` adds the upload nav item; `scripts/build.mjs` generates `/upload/` and copies `_worker.js`; `src/worker.js` implements the protected upload API; `public/scripts/site.js` handles upload form submission; `src/styles/global.css` styles the upload UI; `.github/workflows/deploy.yml` adds automated build/deploy; `scripts/import-docx.mjs` reads uploaded DOCX metadata; `package.json` deploys with a Wrangler wrapper; `docs/content-workflow.md`, `README.md`, and `content/posts/README.md` document the upload path and required secrets; `scripts/deploy-cloudflare-api.mjs` now delegates to Wrangler so Pages Functions are deployed.
- Rollback: revert the next Git commit and redeploy; if only disabling uploads, remove `BLOG_UPLOAD_PASSWORD` and `BLOG_GITHUB_TOKEN` from Cloudflare Pages environment variables so `/api/upload` keeps rejecting writes.

## 2026-07-01 - Task: Configure upload password
### What was done
- Configured the Cloudflare Pages production `BLOG_UPLOAD_PASSWORD` secret for the upload page.
- Redeployed the site so the Pages Worker can read the new production secret.
- Split upload API configuration errors so missing password and missing GitHub token are reported separately.

### Testing
- `npm run deploy` passed and deployed the static assets plus Worker bundle to Cloudflare Pages.
- `https://null-observatory.pages.dev/upload/` returned 200.
- Posting to `/api/upload` with the configured upload password still returned 503 because `BLOG_GITHUB_TOKEN` is not configured yet, confirming the remaining blocker is GitHub write access rather than the upload password.

### Notes
- Changed files: `src/worker.js` separates missing-secret errors; `progress.md` records the Cloudflare secret configuration and verification.
- Rollback: remove the `BLOG_UPLOAD_PASSWORD` secret from Cloudflare Pages production, revert the next Git commit, and redeploy.

## 2026-07-01 - Task: Enable complete upload publishing
### What was done
- Configured the Cloudflare Pages production `BLOG_GITHUB_TOKEN` secret so the upload API can write article files to GitHub.
- Configured the GitHub repository `CLOUDFLARE_API_TOKEN` Actions Secret so uploaded articles can trigger an automated build and Cloudflare Pages deployment.
- Ran a real Markdown-plus-image upload through `/api/upload`, verified GitHub received the files, then removed the draft smoke-test article from the repository.

### Testing
- `npm run deploy` passed after Cloudflare upload secrets were configured.
- Posting a draft Markdown article plus SVG image to `/api/upload` with the configured upload password returned 200 and created a GitHub commit.
- The GitHub Actions run for the upload commit completed successfully.
- The cleanup commit removing the smoke-test draft completed successfully and its GitHub Actions run also completed successfully.
- `https://null-observatory.pages.dev/upload/` returned 200 after the final deployment.

### Notes
- Changed files: `progress.md` records full upload publishing verification; `src/worker.js` remains the deployed upload API with separate missing-secret errors.
- Rollback: remove `BLOG_GITHUB_TOKEN` and `BLOG_UPLOAD_PASSWORD` from Cloudflare Pages production, remove `CLOUDFLARE_API_TOKEN` from GitHub Actions Secrets, revert the upload API commit, and redeploy.

## 2026-07-01 - Task: Auto-detect Markdown upload images
### What was done
- Added Markdown image scanning on the upload page before submission.
- Added automatic extraction for `data:image/...` base64 images embedded in Markdown.
- Added an authorized folder-picker flow so Markdown references pointing to local cache paths can be matched by filename and uploaded as same-folder article images.
- Rewrote matched local Markdown image references to `./image-name` before sending the article to the upload API.
- Added a server-side fallback that rewrites Markdown image references by uploaded image filename, so direct API uploads also avoid preserving local cache paths.

### Testing
- `node --check public/scripts/site.js` passed.
- `node --check src/worker.js` passed.
- `npm run build` passed and generated 5 posts into `dist/`.
- `npm run deploy` passed and deployed the updated upload page plus Worker bundle to Cloudflare Pages.
- `https://null-observatory.pages.dev/upload/` returned 200 and contained the new image-directory matching UI and auto-extraction copy.
- Uploaded `D:\文档\XXE.md` with three `C:\Users\huonawo\AppData\Local\Temp\*.png` image references; the upload API returned 200 and GitHub Actions completed successfully.
- `https://null-observatory.pages.dev/posts/xxe/` and all three `post-assets/xxe/*.png` image URLs returned 200.
- The GitHub Markdown for `content/posts/xxe/index.md` no longer contains `C:\` or `AppData` and contains relative `./178282*.png` image paths.

### Notes
- Changed files: `scripts/build.mjs` adds the upload page controls; `public/scripts/site.js` scans and rewrites Markdown image references before upload; `src/worker.js` rewrites direct-upload Markdown image references by uploaded filename; `src/styles/global.css` styles the matching controls; `docs/content-workflow.md` documents browser limits and the new Markdown image handling behavior; `progress.md` records this round.
- Rollback: revert the next Git commit and redeploy; existing manual image upload and DOCX upload behavior will remain available from the previous deployed version.

## 2026-07-08 - Task: Add smarter Markdown image import
### What was done
- Added a local Markdown import/publish command for Markdown files that reference local absolute paths, relative image files, `file://` images, `data:image/...` images, and remote image URLs.
- Enhanced the upload API so browser uploads can automatically extract embedded base64 images and download remote image URLs, while rejecting unmatched local image paths with a clear local-import instruction instead of publishing broken images.
- Updated upload-page copy and content workflow documentation to separate what the browser can do automatically from what requires the local publish command.

### Testing
- Parsed `src/worker.js`, `scripts/import-md-local.mjs`, `scripts/build.mjs`, and `public/scripts/site.js` with the Node REPL syntax checks; all parsed successfully.
- Could not run `npm run build`, `npm run import:md`, `npm run deploy`, or `git status` in this turn because the current PowerShell runner failed to start with `CreateProcessAsUserW failed: 5` after the sandbox policy changed.

### Notes
- Changed files: `src/worker.js` restores the Pages Worker and adds remote/base64 image extraction plus local-path rejection; `scripts/import-md-local.mjs` adds the local Markdown image importer and optional push workflow; `package.json` adds `import:md` and `publish:md`; `scripts/build.mjs` updates upload-page guidance; `public/scripts/site.js` updates upload UI reset text; `docs/content-workflow.md` documents the new one-command Markdown publishing path; `progress.md` records this round.
- Rollback: revert this commit or remove `scripts/import-md-local.mjs`, remove `import:md` and `publish:md` from `package.json`, and restore the previous `src/worker.js`, upload-page copy, and documentation before redeploying.

## 2026-07-08 - Task: Add PDF uploads and simplify the upload page
### What was done
- Added PDF upload support: uploaded PDFs are saved as `source.pdf`, converted by GitHub Actions with PyMuPDF, and published as Markdown with extracted images in the same post directory.
- Simplified the upload page so the default flow only requires an article file and upload password; title, slug, date, category, tags, summary, and Markdown image matching now live in optional collapsed sections.
- Deployed the updated Cloudflare Pages Worker and static output to `null-observatory`.

### Testing
- `node --check src\worker.js`, `node --check public\scripts\site.js`, `node --check scripts\build.mjs`, and `node --check scripts\import-md-local.mjs` passed.
- `python -m py_compile scripts\import-pdf.py` passed.
- Local PDF smoke test generated `content/posts/pdf-smoke-test/index.md` and `pdf-image-01.png`, then the temporary post directory was deleted.
- `npm run build` passed and built 7 posts after syncing the current remote content.
- `npm run deploy` succeeded; latest checked preview deployment was `https://86591cea.null-observatory.pages.dev`.
- Live PDF upload smoke test returned 200 from `/api/upload`, created `source.pdf` and `upload.json`, GitHub Actions converted it, and `https://null-observatory.pages.dev/posts/pdf-upload-smoke-20260708123711/` showed the PDF text while `post-assets/pdf-upload-smoke-20260708123711/pdf-image-01.png` returned 200.
- The temporary PDF smoke post was deleted through the management API; after the final Cloudflare deployment, the production URL no longer contained `PDF Upload Smoke`.
- `https://null-observatory.pages.dev/upload/` returned 200 and contained `.pdf`, `文章信息（可选）`, `Markdown 图片（可选）`, and `选择 Markdown、DOCX 或 PDF`.

### Notes
- Changed files: `.github/workflows/deploy.yml` installs PyMuPDF and converts uploaded PDFs; `scripts/import-pdf.py` converts PDF text and images into a post; `package.json` adds `import:pdf`; `src/worker.js` accepts PDF uploads; `scripts/build.mjs` simplifies the upload form and accepts PDF; `public/scripts/site.js` updates upload labels; `src/styles/global.css` styles the collapsed upload sections; `docs/content-workflow.md` documents PDF upload and simplified inputs; `progress.md` records this round.
- Rollback: revert commit `fc1b6c2` and this progress-only commit, then run `npm run deploy`; this removes PDF upload support and returns the upload form to the previous expanded layout.

## 2026-07-08 - Task: Optimize tag page and PDF direct display
### What was done
- Rewrote the tag index page (`/tags/`) with a stats header (tag count + post count), SIGNAL INDEX label, and font-size variation based on post frequency — high-frequency tags render larger (`tag-xl`/`tag-l` classes).
- Added a "相关标签" (related tags) section to each tag detail page (`/tags/:tag/`), computed from co-occurring tags across matching posts, capped at 12 entries.
- Added a post-count badge to individual tag page headers.
- Changed PDF upload flow: the Worker now creates `index.md` with `source: "pdf"` frontmatter directly instead of saving `upload.json` for GitHub Actions to convert. No more PDF-to-Markdown conversion.
- Added PDF viewer rendering in `article()`: when `post.source === 'pdf'`, the page renders an `<object>` embed pointing to `/post-assets/<slug>/source.pdf` with a download fallback link, skipping the TOC rail.
- Removed PyMuPDF installation and the PDF conversion block from `.github/workflows/deploy.yml`; DOCX conversion remains unchanged.
- Added `upload.json` to the `sync-post-assets.mjs` ignore list so it no longer leaks into public assets.
- Updated front-end upload page text and Worker success message to reflect inline PDF display.
- Updated `docs/content-workflow.md` PDF section to document the new direct-display behavior.
- Added CSS for tag index stats, tag size classes, related tag cloud, tag page stats, and the PDF viewer container (`pdf-viewer-wrap`, `pdf-embed`, `pdf-fallback`, responsive height adjustments).

### Testing
- `node --check` passed for `scripts/build.mjs`, `src/worker.js`, `scripts/sync-post-assets.mjs`, and `public/scripts/site.js`.
- `npm run build` passed and generated 7 posts.
- `/tags/index.html` output verified: stats header shows "18 个标签 / 7 篇文章", CTF (count 2) has `tag-xl` class, other tags have default size.
- `/tags/CTF/index.html` verified: "相关标签" section shows XXE, Web, 渗透测试, 信息泄露.
- Created a temporary `source: "pdf"` test post, built, and verified `/posts/pdf-render-test/index.html` contains `<object data="/post-assets/pdf-render-test/source.pdf" type="application/pdf" class="pdf-embed">` with fallback link.
- Verified `source.pdf` is copied to `dist/post-assets/<slug>/source.pdf` and `upload.json` is excluded from public assets.
- Verified `.github/workflows/deploy.yml` no longer contains `pymupdf`, `import:pdf`, or PDF conversion logic; step renamed to "Convert uploaded DOCX posts".
- Test post removed and final build produces 7 posts cleanly.

### Notes
- Changed files: `scripts/build.mjs` rewrites `tagIndex()`, `article()`, tag detail page rendering, and upload help text; `src/worker.js` splits PDF and DOCX upload branches, PDF now creates `index.md` directly; `scripts/sync-post-assets.mjs` adds `upload.json` to ignored set; `public/scripts/site.js` updates PDF description text; `.github/workflows/deploy.yml` removes PyMuPDF setup and PDF conversion block; `src/styles/global.css` adds tag index, related tags, and PDF viewer styles; `docs/content-workflow.md` updates PDF documentation; `progress.md` records this round.
- Rollback: revert this commit and run `npm run deploy`; PDF uploads will return to the `upload.json` + GitHub Actions conversion flow, and the tag page will revert to the flat cloud without stats or related tags.
