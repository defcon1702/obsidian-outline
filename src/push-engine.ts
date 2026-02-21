import { App, Notice, TFile, TFolder } from "obsidian";
import { OutlineClient } from "./outline-client";
import { OutlineSyncSettings } from "./settings";
import { getOutlineMeta, updateOutlineFrontmatter } from "./frontmatter";
import { convertToOutlineMarkdown, resolveWikiLinksWithCache } from "./markdown-converter";

export class PushEngine {
	private app: App;
	private client: OutlineClient;
	private settings: OutlineSyncSettings;

	constructor(app: App, client: OutlineClient, settings: OutlineSyncSettings) {
		this.app = app;
		this.client = client;
		this.settings = settings;
	}

	async pushFile(file: TFile, collectionId?: string): Promise<void> {
		if (!this.validateConfig()) return;

		const targetCollection = collectionId ?? this.settings.targetCollectionId;
		const notice = new Notice(`Pushing "${file.basename}" to Outline…`, 0);

		try {
			const rawContent = await this.app.vault.read(file);
			const { markdown, images } = await convertToOutlineMarkdown(this.app, file, rawContent);

			let resolvedMarkdown = markdown;
			if (images.length > 0) {
				resolvedMarkdown = await this.uploadImagesAndReplace(file, markdown, images);
			}

			const meta = getOutlineMeta(rawContent);
			const title = file.basename;

			if (meta.outline_id) {
				const existing = await this.client.getDocument(meta.outline_id);
				if (existing) {
					const updated = await this.client.updateDocument({
						id: meta.outline_id,
						title,
						text: resolvedMarkdown,
						publish: true,
					});
					if (!updated) throw new Error("Update fehlgeschlagen");
					notice.hide();
					new Notice(`✓ "${title}" aktualisiert in Outline`);
					return;
				}
			}

			const created = await this.client.createDocument({
				title,
				text: resolvedMarkdown,
				collectionId: targetCollection,
				publish: true,
			});

			if (!created) throw new Error("Erstellen fehlgeschlagen");

			await updateOutlineFrontmatter(this.app, file, {
				outline_id: created.id,
				outline_collection_id: created.collectionId,
				outline_last_synced: new Date().toISOString(),
			});

			notice.hide();
			new Notice(`✓ "${title}" gepusht → Outline`, 5000);

		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`✗ Push fehlgeschlagen: ${msg}`, 8000);
			console.error("[Outline Sync] pushFile error:", e);
		}
	}

	async pushFolder(folder: TFolder, collectionId?: string): Promise<void> {
		if (!this.validateConfig()) return;

		const targetCollection = collectionId ?? this.settings.targetCollectionId;
		const files = this.collectMarkdownFiles(folder);
		if (files.length === 0) {
			new Notice("Keine Markdown-Dateien im Ordner gefunden.");
			return;
		}

		const notice = new Notice(`Pushing ${files.length} Dateien zu Outline…`, 0);
		let success = 0;
		let failed = 0;

		const fileContentCache = new Map<string, string>();
		for (const file of files) {
			fileContentCache.set(file.path, await this.app.vault.read(file));
		}

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			notice.setMessage(`Pushing ${i + 1}/${files.length}: ${file.basename}…`);

			try {
				const rawContent = fileContentCache.get(file.path) ?? await this.app.vault.read(file);
				const { markdown, images } = await convertToOutlineMarkdown(this.app, file, rawContent);

				let resolvedMarkdown = await resolveWikiLinksWithCache(this.app, markdown, fileContentCache);
				if (images.length > 0) {
					resolvedMarkdown = await this.uploadImagesAndReplace(file, resolvedMarkdown, images);
				}

				const meta = getOutlineMeta(rawContent);
				const title = file.basename;

				if (meta.outline_id) {
					const existing = await this.client.getDocument(meta.outline_id);
					if (existing) {
						await this.client.updateDocument({
							id: meta.outline_id,
							title,
							text: resolvedMarkdown,
							publish: true,
						});
						const updatedRaw = fileContentCache.get(file.path) ?? rawContent;
						fileContentCache.set(file.path, updatedRaw);
						success++;
						continue;
					}
				}

				const created = await this.client.createDocument({
					title,
					text: resolvedMarkdown,
					collectionId: targetCollection,
					publish: true,
				});

				if (!created) throw new Error("API returned null");

				await updateOutlineFrontmatter(this.app, file, {
					outline_id: created.id,
					outline_collection_id: created.collectionId,
					outline_last_synced: new Date().toISOString(),
				});

				const refreshed = await this.app.vault.read(file);
				fileContentCache.set(file.path, refreshed);

				success++;
			} catch (e) {
				failed++;
				console.error(`[Outline Sync] Failed to push "${file.path}":`, e);
			}
		}

		notice.hide();
		const msg = failed > 0
			? `✓ ${success} gepusht, ✗ ${failed} fehlgeschlagen`
			: `✓ ${success} Dateien erfolgreich gepusht`;
		new Notice(msg, 6000);
	}

	private async uploadImagesAndReplace(
		_file: TFile,
		markdown: string,
		images: { obsidianPath: string; placeholder: string }[]
	): Promise<string> {
		let result = markdown;

		for (const img of images) {
			const imageFile = this.app.vault.getAbstractFileByPath(img.obsidianPath);
			if (!(imageFile instanceof TFile)) {
				result = result.replace(img.placeholder, `*(Bild nicht gefunden)*`);
				continue;
			}

			const ext = imageFile.extension.toLowerCase();
			const contentType = this.getContentType(ext);
			const fileData = await this.app.vault.readBinary(imageFile);

			const attachmentMeta = await this.client.createAttachment({
				name: imageFile.name,
				contentType,
				size: fileData.byteLength,
			});

			if (!attachmentMeta) {
				result = result.replace(img.placeholder, `*(Upload fehlgeschlagen: ${imageFile.name})*`);
				continue;
			}

			const uploaded = await this.client.uploadAttachmentToStorage(
				attachmentMeta.uploadUrl,
				attachmentMeta.form,
				fileData,
				contentType
			);

			if (uploaded) {
				result = result.replace(img.placeholder, `![${imageFile.basename}](${attachmentMeta.attachment.url})`);
			} else {
				result = result.replace(img.placeholder, `*(Upload fehlgeschlagen: ${imageFile.name})*`);
			}
		}

		return result;
	}

	private collectMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.collectMarkdownFiles(child));
			}
		}
		return files;
	}

	private getContentType(ext: string): string {
		const map: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			svg: "image/svg+xml",
			bmp: "image/bmp",
		};
		return map[ext] ?? "application/octet-stream";
	}

	private validateConfig(): boolean {
		if (!this.settings.outlineUrl || !this.settings.apiKey) {
			new Notice("Outline Sync: Bitte URL und API Key in den Einstellungen konfigurieren.");
			return false;
		}
		if (!this.settings.targetCollectionId) {
			new Notice("Outline Sync: Bitte eine Ziel-Collection in den Einstellungen wählen.");
			return false;
		}
		return true;
	}
}
