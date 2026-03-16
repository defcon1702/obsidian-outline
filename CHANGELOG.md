# Changelog

All notable changes to this project will be documented in this file.

## [1.8.0] – 2026-03-16

### Added / Changed – Major refactor by [@matthias-feddersen](https://github.com/matthias-feddersen)

A huge thank you to **Matthias Feddersen** for his substantial contribution to this release.
He refactored large parts of the codebase and added significant new capabilities:

- Modular pipeline architecture for Markdown transformers
- Improved callout conversion (info, warning, success, tip)
- Optional table-of-contents removal (plugin setting + `REMOVE_TOC` CLI env var)
- CLI runner (`npm run sync`) to push folders without Obsidian
- Auto-generated, fully typed Outline API client via Orval + OpenAPI spec
- Adapter pattern separating Obsidian and Node.js environments
- Comprehensive test suite (Jest) covering pipeline, callouts, frontmatter, images, TOC, wiki-links, document tree, folder sync
- Fix: internal wiki-links resolved correctly
- Fix: empty pages no longer disrupt folder/document tree structure
- Improved sync progress display and logging
- Prettier formatting setup

## [1.7.0] – 2026-03-?

- i18n: All UI strings switched to English

## [1.6.0] – 2026-03-?

- fix: Image upload fully repaired

## [1.5.1] – 2026-03-?

- fix: Two-step image upload – documentId known before upload

## [1.5.0] – 2026-03-?

- security: Audit corrections (all 8 points addressed)

## [1.4.0] – 2026-03-?

- feat: Nested folder structure via `parentDocumentId`

## [1.3.1] – 2026-03-?

- fix: Conflict modal also triggered when `outline_id` is already known

## [1.3.0] – 2026-03-?

- feat: Conflict modal with overwrite / duplicate-suffix option

## [1.2.0] – 2026-03-?

- feat: Duplicate handling via `documents.search`

## [1.1.1] – 2026-03-?

- fix: `validateConfig` no longer checks `targetCollectionId`

## [1.1.0] – 2026-03-?

- feat: Collection-Picker modal + collections cached on startup

## [1.0.0] – 2026-02-20

- Initial release: full plugin foundation implemented
