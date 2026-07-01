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
