import { App, Notice, TFile, TFolder } from "obsidian";
import { OutlineClient } from "./outline-client";
import { OutlineSyncSettings } from "./settings";
import { getOutlineMeta, updateOutlineFrontmatter } from "./frontmatter";
import { convertToOutlineMarkdown, resolveWikiLinksWithCache } from "./markdown-converter";
import { resolveConflict, resolveFolderConflictStrategy } from "./conflict-modal";

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
			const { markdown, images } = await convertToOutlineMarkdown(this.app, file, rawContent, {
				removeToc: this.settings.removeToc,
			});
			const resolvedMarkdown = markdown;

			const meta = getOutlineMeta(rawContent);
			const title = file.basename;

			const knownId = meta.outline_id
				? (await this.client.getDocument(meta.outline_id))?.id ?? null
				: null;
			const duplicate = knownId
				? { id: knownId, collectionId: targetCollection }
				: await this.client.searchDocumentByTitle(title, targetCollection);

			let documentId: string;
			let documentCollectionId: string;
			let noticeText: string;

			if (duplicate) {
				notice.hide();
				const resolution = await resolveConflict(this.app, title);
				if (resolution === "cancel") return;

				if (resolution === "overwrite") {
					const updated = await this.client.updateDocument({
						id: duplicate.id,
						title,
						text: resolvedMarkdown,
						publish: true,
					});
					if (!updated) throw new Error("Update failed");
					documentId = duplicate.id;
					documentCollectionId = duplicate.collectionId;
					noticeText = `✓ "${title}" overwritten in Outline`;
				} else {
					const uniqueTitle = await this.findAvailableTitle(title, targetCollection);
					const created = await this.client.createDocument({
						title: uniqueTitle,
						text: resolvedMarkdown,
						collectionId: targetCollection,
						publish: true,
					});
					if (!created) throw new Error("Create failed");
					documentId = created.id;
					documentCollectionId = created.collectionId;
					noticeText = `✓ "${uniqueTitle}" created as duplicate`;
				}
			} else {
				const created = await this.client.createDocument({
					title,
					text: resolvedMarkdown,
					collectionId: targetCollection,
					publish: true,
				});
				if (!created) throw new Error("Create failed");
				documentId = created.id;
				documentCollectionId = created.collectionId;
				noticeText = `✓ "${title}" pushed to Outline`;
			}

			if (images.length > 0) {
				const withImages = await this.uploadImagesAndReplace(file, resolvedMarkdown, images, documentId);
				await this.client.updateDocument({
					id: documentId,
					title,
					text: withImages,
					publish: true,
				});
			}

			await updateOutlineFrontmatter(this.app, file, {
				outline_id: documentId,
				outline_collection_id: documentCollectionId,
				outline_last_synced: new Date().toISOString(),
			});

			notice.hide();
			new Notice(noticeText, 5000);

		} catch (e) {
			notice.hide();
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`✗ Push failed: ${msg}`, 8000);
			console.error("[Outline Sync] pushFile error:", e);
		}
	}

	async pushFolder(folder: TFolder, collectionId?: string): Promise<void> {
		if (!this.validateConfig()) return;

		const targetCollection = collectionId ?? this.settings.targetCollectionId;
		const allFiles = this.collectMarkdownFiles(folder);
		if (allFiles.length === 0) {
			new Notice("No Markdown files found in folder.");
			return;
		}

		const folderStrategy = await resolveFolderConflictStrategy(this.app);
		if (folderStrategy === "cancel") return;

		const notice = new Notice(`Pushing ${folder.name}…`, 0);
		const counter = { success: 0, failed: 0 };
		const fileContentCache = new Map<string, string>();
		for (const file of allFiles) {
			fileContentCache.set(file.path, await this.app.vault.read(file));
		}

		await this.pushFolderRecursive(
			folder,
			targetCollection,
			undefined,
			folderStrategy,
			fileContentCache,
			notice,
			counter,
			true
		);

		notice.hide();
		const msg = counter.failed > 0
			? `✓ ${counter.success} pushed, ✗ ${counter.failed} failed`
			: `✓ ${counter.success} file(s) successfully pushed`;
		new Notice(msg, 6000);
	}

	private async pushFolderRecursive(
		folder: TFolder,
		collectionId: string,
		parentDocumentId: string | undefined,
		strategy: "overwrite" | "duplicate",
		fileContentCache: Map<string, string>,
		notice: Notice,
		counter: { success: number; failed: number },
		isRoot: boolean
	): Promise<void> {
		let folderDocId: string | undefined = parentDocumentId;

		if (!isRoot) {
			const existing = await this.client.searchDocumentByTitle(folder.name, collectionId);
			if (existing) {
				folderDocId = existing.id;
			} else {
				const folderDoc = await this.client.createDocument({
					title: folder.name,
					text: "",
					collectionId,
					publish: true,
					parentDocumentId,
				});
				folderDocId = folderDoc?.id;
			}
		}

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				notice.setMessage(`Pushing ${child.basename}…`);
				try {
					await this.pushFileInFolder(child, collectionId, folderDocId, strategy, fileContentCache);
					counter.success++;
				} catch (e) {
					counter.failed++;
					console.error(`[Outline Sync] Failed to push "${child.path}":`, e);
				}
			} else if (child instanceof TFolder) {
				await this.pushFolderRecursive(
					child,
					collectionId,
					folderDocId,
					strategy,
					fileContentCache,
					notice,
					counter,
					false
				);
			}
		}
	}

	private async pushFileInFolder(
		file: TFile,
		collectionId: string,
		parentDocumentId: string | undefined,
		strategy: "overwrite" | "duplicate",
		fileContentCache: Map<string, string>
	): Promise<void> {
		const rawContent = fileContentCache.get(file.path) ?? await this.app.vault.read(file);
		const { markdown, images } = await convertToOutlineMarkdown(this.app, file, rawContent, {
			removeToc: this.settings.removeToc,
		});
		const resolvedMarkdown = await resolveWikiLinksWithCache(this.app, markdown, fileContentCache);

		const meta = getOutlineMeta(rawContent);
		const title = file.basename;

		const knownId = meta.outline_id
			? (await this.client.getDocument(meta.outline_id))?.id ?? null
			: null;
		const duplicate = knownId
			? { id: knownId, collectionId }
			: await this.client.searchDocumentByTitle(title, collectionId);

		let documentId: string;
		let documentCollectionId: string;

		if (duplicate) {
			if (strategy === "overwrite") {
				await this.client.updateDocument({
					id: duplicate.id,
					title,
					text: resolvedMarkdown,
					publish: true,
				});
				documentId = duplicate.id;
				documentCollectionId = duplicate.collectionId;
			} else {
				const uniqueTitle = await this.findAvailableTitle(title, collectionId);
				const dup = await this.client.createDocument({
					title: uniqueTitle,
					text: resolvedMarkdown,
					collectionId,
					publish: true,
					parentDocumentId,
				});
				if (!dup) throw new Error("Create duplicate failed");
				documentId = dup.id;
				documentCollectionId = dup.collectionId;
			}
		} else {
			const created = await this.client.createDocument({
				title,
				text: resolvedMarkdown,
				collectionId,
				publish: true,
				parentDocumentId,
			});
			if (!created) throw new Error("API returned null"); 
			documentId = created.id;
			documentCollectionId = created.collectionId;
		}

		if (images.length > 0) {
			const withImages = await this.uploadImagesAndReplace(file, resolvedMarkdown, images, documentId);
			await this.client.updateDocument({
				id: documentId,
				title,
				text: withImages,
				publish: true,
			});
		}

		await updateOutlineFrontmatter(this.app, file, {
			outline_id: documentId,
			outline_collection_id: documentCollectionId,
			outline_last_synced: new Date().toISOString(),
		});
		const refreshed = await this.app.vault.read(file);
		fileContentCache.set(file.path, refreshed);
	}

	private async uploadImagesAndReplace(
		_file: TFile,
		markdown: string,
		images: { obsidianPath: string; placeholder: string }[],
		documentId?: string
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
				documentId,
			});

			if (!attachmentMeta) {
				console.error(`[Outline Sync] attachments.create fehlgeschlagen für "${imageFile.name}"`);
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

	private async findAvailableTitle(baseTitle: string, collectionId: string): Promise<string> {
		const MAX_ATTEMPTS = 50;
		let counter = 1;
		let candidate = `${baseTitle}-${counter}`;
		while (counter <= MAX_ATTEMPTS && await this.client.searchDocumentByTitle(candidate, collectionId)) {
			counter++;
			candidate = `${baseTitle}-${counter}`;
		}
		return candidate;
	}

	private validateConfig(): boolean {
		if (!this.settings.outlineUrl || !this.settings.apiKey) {
			new Notice("Outline Sync: Please configure URL and API key in settings.");
			return false;
		}
		return true;
	}
}
