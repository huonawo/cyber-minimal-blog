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

### Notes
- Changed files: `src/data/site.js` adds the upload nav item; `scripts/build.mjs` generates `/upload/` and copies `_worker.js`; `src/worker.js` implements the protected upload API; `public/scripts/site.js` handles upload form submission; `src/styles/global.css` styles the upload UI; `.github/workflows/deploy.yml` adds automated build/deploy; `scripts/import-docx.mjs` reads uploaded DOCX metadata; `package.json` deploys with a Wrangler wrapper; `docs/content-workflow.md`, `README.md`, and `content/posts/README.md` document the upload path; `scripts/deploy-cloudflare-api.mjs` now delegates to Wrangler so Pages Functions are deployed.
- Rollback: revert the next Git commit and redeploy; if only disabling uploads, remove `BLOG_UPLOAD_PASSWORD` and `BLOG_GITHUB_TOKEN` from Cloudflare Pages environment variables so `/api/upload` keeps rejecting writes.
