import { getOutlineMeta, resolveWikiLinkMarkers } from "../pipeline";
import { buildDocumentTree } from "../pipeline";
import type { DocNode } from "../pipeline";
import { convertContentToOutlineMarkdown } from "../convert";
import { getErrorMessage } from "../utils/errors";
import type { SyncOptions, SyncEnv, SyncResult, SyncDocumentResult, ConflictResolution } from "./types";

async function findAvailableTitle(
	api: SyncEnv["api"],
	baseTitle: string,
	collectionId: string,
	parentDocumentId?: string,
): Promise<string> {
	const MAX_ATTEMPTS = 50;
	let counter = 1;
	let candidate = `${baseTitle}-${counter}`;
	while (
		counter <= MAX_ATTEMPTS &&
		(await api.searchDocumentByTitle(candidate, collectionId, parentDocumentId))
	) {
		counter++;
		candidate = `${baseTitle}-${counter}`;
	}
	return candidate;
}

/**
 * Sync a single document. Used for one-file push and as the inner step for folder sync.
 */
export async function syncDocument(
	options: SyncOptions,
	env: SyncEnv,
	fd: { path: string; basename: string },
	parentDocumentId?: string,
): Promise<SyncDocumentResult | null> {
	const rawContent = await env.readFile(fd);
	const meta = getOutlineMeta(rawContent);
	const wikiResolver = env.getWikiResolver();
	const { markdown, imageRefs } = convertContentToOutlineMarkdown(
		rawContent,
		{
			removeToc: options.removeToc,
			outlineUrl: options.outlineUrl,
			preserveUnresolved: options.preserveUnresolved,
		},
		fd.basename,
		fd.path,
		wikiResolver,
	);

	const collectionId = options.collectionId;
	let knownDoc = meta.outline_id
		? await env.api.getDocument(meta.outline_id)
		: null;
	if (knownDoc && knownDoc.collectionId !== collectionId) {
		knownDoc = null;
	}
	const duplicate = knownDoc
		? { id: knownDoc.id!, collectionId: knownDoc.collectionId! }
		: await env.api.searchDocumentByTitle(fd.basename, collectionId, parentDocumentId);

	let documentId: string;
	let documentCollectionId: string;
	let action: "created" | "updated";
	let resolution: ConflictResolution = "overwrite";

	if (duplicate) {
		if (env.resolveConflict) {
			resolution = await env.resolveConflict(fd.basename);
			if (resolution === "cancel") return null;
		} else {
			resolution = options.folderConflictStrategy;
		}

		if (resolution === "overwrite") {
			const updated = await env.api.updateDocument({
				id: duplicate.id!,
				title: fd.basename,
				text: markdown,
				publish: true,
			});
			if (!updated) throw new Error("Update failed");
			documentId = duplicate.id!;
			documentCollectionId = duplicate.collectionId!;
			action = "updated";
		} else {
			const uniqueTitle = await findAvailableTitle(
				env.api,
				fd.basename,
				collectionId,
				parentDocumentId,
			);
			const created = await env.api.createDocument({
				title: uniqueTitle,
				text: markdown,
				collectionId,
				publish: true,
				parentDocumentId,
			});
			if (!created) throw new Error("Create failed");
			documentId = created.id!;
			documentCollectionId = created.collectionId!;
			action = "created";
		}
	} else {
		const created = await env.api.createDocument({
			title: fd.basename,
			text: markdown,
			collectionId,
			publish: true,
			parentDocumentId,
		});
		if (!created) throw new Error("Create failed");
		documentId = created.id!;
		documentCollectionId = created.collectionId!;
		action = "created";
	}

	let finalMarkdown = markdown;
	let imagesUploaded = 0;
	if (imageRefs.length > 0) {
		for (const ref of imageRefs) {
			const resolved = env.resolveImage(fd, ref);
			if (!resolved) {
				finalMarkdown = finalMarkdown.replace(ref.placeholder, `*(Image not found: ${ref.imageName})*`);
				continue;
			}
			const bytes = await env.readImageBytes(resolved.pathOrKey);
			const attachment = await env.api.createAttachment({
				name: resolved.fileName,
				contentType: resolved.contentType,
				size: bytes.byteLength,
				documentId,
			});
			if (!attachment?.uploadUrl || !attachment.form) {
				finalMarkdown = finalMarkdown.replace(
					ref.placeholder,
					`*(Upload failed: ${resolved.fileName})*`,
				);
				continue;
			}
			const uploaded = await env.api.uploadAttachmentToStorage(
				attachment.uploadUrl,
				attachment.form,
				bytes,
				resolved.contentType,
			);
			if (uploaded) {
				const alt = resolved.fileName.replace(/\.[^.]+$/, "");
				finalMarkdown = finalMarkdown.replace(
					ref.placeholder,
					`![${alt}](${attachment.attachment?.url ?? ""})`,
				);
				imagesUploaded++;
			} else {
				finalMarkdown = finalMarkdown.replace(
					ref.placeholder,
					`*(Upload failed: ${resolved.fileName})*`,
				);
			}
		}
		await env.api.updateDocument({
			id: documentId,
			title: fd.basename,
			text: finalMarkdown,
			publish: true,
		});
	}

	await env.writeFrontmatter(fd, documentId, documentCollectionId);

	const imageStats = imageRefs.length > 0
		? { uploaded: imagesUploaded, total: imageRefs.length }
		: undefined;

	return { documentId, collectionId, action, imageStats, finalMarkdown };
}

/**
 * Sync a full folder: build tree from listed files, then sync each document in order.
 */
export async function syncFolder(
	options: SyncOptions,
	env: SyncEnv,
	rootPath: string,
): Promise<SyncResult> {
	const files = await env.listMarkdownFiles(rootPath);
	if (files.length === 0) {
		env.onProgress?.("No markdown files found.");
		return { success: 0, failed: 0, total: 0 };
	}

	env.onProgress?.(`Found ${files.length} markdown file(s)`);
	env.onProgress?.(`Index as folder: ${options.indexAsFolder}`);

	const relativePaths = files.map((f) => f.relativePath ?? f.path);
	const tree = buildDocumentTree(relativePaths, {
		indexAsFolder: options.indexAsFolder,
	});

	const contentMap = new Map<string, string>();
	for (const fd of files) {
		const key = fd.relativePath ?? fd.path;
		contentMap.set(key, await env.readFile(fd));
	}
	const filesWithContent = files.map((fd) => ({
		path: fd.relativePath ?? fd.path,
		content: contentMap.get(fd.relativePath ?? fd.path)!,
	}));
	const wikiResolver = env.getWikiResolver(filesWithContent);

	const fdByRelativePath = new Map<string, (typeof files)[0]>();
	for (const fd of files) {
		fdByRelativePath.set(fd.relativePath ?? fd.path, fd);
	}

	const result: SyncResult = { success: 0, failed: 0, total: files.length };

	const pass1Options: SyncOptions = { ...options, preserveUnresolved: true };
	const envWithResolver: SyncEnv = {
		...env,
		getWikiResolver: () => wikiResolver,
	};

	const syncedDocs: { title: string; documentId: string; finalMarkdown: string }[] = [];

	async function syncNode(node: DocNode, parentDocumentId: string | undefined, depth: number): Promise<void> {
		const indent = "  ".repeat(depth);
		const prefix = node.isFolder ? "[D] " : "";
		let nextParentId = parentDocumentId;

		if (node.filePath) {
			const fd = fdByRelativePath.get(node.filePath);
			if (fd) {
				const effectiveFd = node.isFolder
					? { ...fd, basename: node.title }
					: fd;
				try {
					const res = await syncDocument(pass1Options, envWithResolver, effectiveFd, parentDocumentId);
					if (res) {
						nextParentId = res.documentId;
						result.success++;
						if (res.finalMarkdown) {
							syncedDocs.push({
								title: effectiveFd.basename,
								documentId: res.documentId,
								finalMarkdown: res.finalMarkdown,
							});
						}
						let detail = res.action;
						if (res.imageStats) {
							detail += ` (${res.imageStats.uploaded}/${res.imageStats.total} images)`;
						}
						env.onProgress?.(`${indent}${prefix}${node.title}… ${detail} ✓`);
					}
				} catch (e) {
					result.failed++;
					const msg = getErrorMessage(e);
					env.onProgress?.(`${indent}${prefix}${node.title}… ✗ ${msg}`);
					console.error(`[Outline Sync] Failed to push "${fd.path}":`, e);
				}
			}
		} else if (node.isFolder && node.children.length > 0) {
			try {
				const existing = await env.api.searchDocumentByTitle(
					node.title,
					options.collectionId,
					parentDocumentId,
				);
				if (existing?.id) {
					nextParentId = existing.id;
					env.onProgress?.(`${indent}${prefix}${node.title}… exists ✓`);
				} else {
					const created = await env.api.createDocument({
						title: node.title,
						text: "",
						collectionId: options.collectionId,
						publish: true,
						parentDocumentId,
					});
					if (created?.id) {
						nextParentId = created.id;
						env.onProgress?.(`${indent}${prefix}${node.title}… created ✓`);
					}
				}
			} catch (e) {
				const msg = getErrorMessage(e);
				env.onProgress?.(`${indent}${prefix}${node.title}… ✗ ${msg}`);
				console.error(`[Outline Sync] Failed to create folder "${node.title}":`, e);
			}
		}
		for (const child of node.children) {
			await syncNode(child, nextParentId, depth + 1);
		}
	}

	for (const root of tree) {
		await syncNode(root, undefined, 0);
	}

	// Pass 2: resolve any %%WIKILINK[target|display]%% markers left from pass 1.
	// Build a complete resolver that includes all newly created documents.
	const MARKER_RE = /%%WIKILINK\[/;
	const docsWithMarkers = syncedDocs.filter((d) => MARKER_RE.test(d.finalMarkdown));

	if (docsWithMarkers.length > 0) {
		const completeMap = new Map<string, string>();
		for (const d of syncedDocs) {
			completeMap.set(d.title, d.documentId);
		}
		const completeResolver = (target: string) =>
			wikiResolver(target) ?? completeMap.get(target) ?? null;

		env.onProgress?.("Resolving cross-references…");
		for (const doc of docsWithMarkers) {
			const resolved = resolveWikiLinkMarkers(
				doc.finalMarkdown,
				completeResolver,
				options.outlineUrl,
			);
			if (resolved !== doc.finalMarkdown) {
				try {
					await env.api.updateDocument({
						id: doc.documentId,
						title: doc.title,
						text: resolved,
						publish: true,
					});
					env.onProgress?.(`  ${doc.title}… links updated ✓`);
				} catch (e) {
					const msg = getErrorMessage(e);
					env.onProgress?.(`  ${doc.title}… link update ✗ ${msg}`);
				}
			}
		}
	}

	return result;
}
