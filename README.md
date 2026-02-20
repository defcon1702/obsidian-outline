# Outline Sync – Obsidian Plugin

Push Obsidian notes and folders to your [Outline](https://www.getoutline.com/) knowledge base with a single click.

## Features

- **Push single note** – via Command Palette or right-click menu
- **Push entire folder** – all Markdown files land flat in your target collection
- **Smart re-push** – already pushed notes are updated, not duplicated (tracked via frontmatter)
- **Image upload** – embedded images (`![[image.png]]`) are uploaded to Outline automatically
- **Wiki-link resolution** – `[[Note Name]]` links are converted to real Outline document links if the target has already been pushed
- **Callout conversion** – Obsidian callouts (`> [!NOTE]`) are converted to standard blockquotes
- Works with **self-hosted** and **cloud** Outline instances

## Requirements

- Obsidian 1.0 or later (Desktop only)
- An Outline instance (self-hosted or [app.getoutline.com](https://app.getoutline.com))
- An Outline API key (Settings → API & Apps)

## Installation

### From Obsidian Community Plugins (recommended)

1. Open Obsidian Settings → Community Plugins
2. Search for **Outline Sync**
3. Install and enable

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

## Development

```bash
git clone https://github.com/defcon1702/obsidian-outline
cd obsidian-outline
npm install
npm run dev
```

Copy the plugin folder to `<vault>/.obsidian/plugins/obsidian-outline-sync/` and enable it in Obsidian.

## License

MIT
