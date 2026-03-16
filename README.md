# Outline Sync – Obsidian Plugin

Push Obsidian notes and folders to your [Outline](https://www.getoutline.com/) knowledge base with a single click.

## Features

- **Push single note** – via Command Palette or right-click menu
- **Push entire folder** – folder structure is preserved as nested documents in Outline
- **Conflict resolution** – modal asks whether to overwrite or create a duplicate (with suffix `-1`, `-2`, …)
- **Smart re-push** – already pushed notes are detected by ID or title (tracked via frontmatter)
- **Image upload** – embedded images (`![[image.png]]`) are uploaded to Outline automatically
- **Wiki-link resolution** – `[[Note Name]]` links are converted to real Outline document links if the target has already been pushed
- **Callout conversion** – Obsidian callouts (`> [!NOTE]`, `> [!warning]`, etc.) are converted to Outline’s fence format (`:::info`, `:::warning`, `:::success`, `:::tip` … `:::`)
- **TOC removal** – optionally strips table-of-contents blocks before pushing (toggle in plugin settings or `REMOVE_TOC` env var for CLI)
- Works with **self-hosted** and **cloud** Outline instances

## Requirements

- Obsidian 1.0 or later (Desktop only)
- An Outline instance (self-hosted or [app.getoutline.com](https://app.getoutline.com))
- An Outline API key (Settings → API & Apps)

## Installation

### From Obsidian Community Plugins (coming soon)

> **Note:** This plugin is not yet listed in the official Obsidian Community Plugin directory. Manual installation is required for now.

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/defcon1702/obsidian-outline/releases)
2. Copy both files to `<vault>/.obsidian/plugins/obsidian-outline-sync/`
3. Enable the plugin in Obsidian Settings → Community Plugins

## Configuration

1. Open **Settings → Outline Sync**
2. Enter your **Outline URL** (e.g. `https://outline.example.com`)
3. Enter your **API Key**
4. Click **Verbinden** – the plugin validates the key and loads your collections
5. Select a **target collection** from the dropdown

## Usage

### Push a single note

- Right-click any Markdown file → **Push zu Outline**
- Or open the file and run **Push aktive Datei zu Outline** from the Command Palette

### Push a folder

- Right-click any folder → **Ordner zu Outline pushen**
- Or open any file in the folder and run **Push Ordner zu Outline** from the Command Palette

### How sync tracking works

After the first push, the plugin writes metadata to the note's YAML frontmatter:

```yaml
---
outline_id: "uuid-of-the-outline-document"
outline_collection_id: "uuid-of-the-collection"
outline_last_synced: "2026-02-20T18:00:00.000Z"
---
```

On subsequent pushes, the plugin detects `outline_id` and updates the existing document instead of creating a duplicate.

## CLI / Standalone Sync

You can push an entire local folder to Outline without Obsidian, using the bundled CLI runner.

1. Copy `.env.example` to `.env` and fill in your values:

```env
OUTLINE_URL=https://outline.example.com
OUTLINE_API_KEY=ol_api_your_key_here
OUTLINE_COLLECTION_ID=your-collection-id
OBSIDIAN_FOLDER=/path/to/your/obsidian/vault
INDEX_AS_FOLDER=true
REMOVE_TOC=false
```

2. Run the sync:

```bash
npm run sync
```

The CLI authenticates, resolves the target collection (by UUID, slug, or name), and pushes every Markdown file in the folder. Progress is printed to stdout.

## Development

```bash
git clone https://github.com/defcon1702/obsidian-outline
cd obsidian-outline
npm install
```

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Build the plugin in watch mode (development) |
| `npm run build` | Type-check and produce a production build |
| `npm run test` | Run the test suite (Jest) |
| `npm run sync` | Push a local folder to Outline via CLI (see above) |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run generate:api` | Regenerate the Outline API client from the OpenAPI spec |

To test the plugin inside Obsidian, copy the build output to `<vault>/.obsidian/plugins/obsidian-outline-sync/` and enable it in Obsidian.

### Updating the Outline API client

The typed API client in `src/outline-api/generated-client/` is auto-generated from the OpenAPI spec using [Orval](https://orval.dev/). To regenerate it after updating the spec:

1. Replace `src/outline-api/outline-openapi-spec3.json` with the latest spec from your Outline instance
2. Run `npm run generate:api`
3. The generated client uses a custom fetch wrapper defined in `src/outline-api/custom-instance.ts`

## Disclaimer

This plugin was created to the best of our knowledge and belief, but developed with the assistance of AI – specifically [Claude Sonnet](https://www.anthropic.com/claude) via [Windsurf](https://www.codeium.com/windsurf). While the code has been reviewed and tested, use it at your own risk. No warranty is provided.

## Security

The API key is stored in plain text in `.obsidian/plugins/obsidian-outline-sync/data.json`. If you use a cloud sync service (iCloud, Dropbox, Google Drive, Obsidian Sync), make sure to **exclude this file** from sync to avoid exposing your API key.

Example `.gitignore` / sync exclusion:

```gitignore
.obsidian/plugins/obsidian-outline-sync/data.json
```

## License

MIT
