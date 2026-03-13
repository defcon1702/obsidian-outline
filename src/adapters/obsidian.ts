import { App, TFile, TFolder } from "obsidian";
import { getOutlineMeta } from "../pipeline";
import { updateOutlineFrontmatter } from "../frontmatter";
import type { SyncEnv, FileDescriptor, ResolvedImage, ImageRefLike } from "../sync";
import type { IOutlineApi } from "../outline-api/types";

interface ObsidianFd extends FileDescriptor {
	_file: TFile;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	bmp: "image/bmp",
};

function getContentType(ext: string): string {
	return CONTENT_TYPE_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

function collectMarkdownFiles(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === "md") {
			files.push(child);
		} else if (child instanceof TFolder) {
			files.push(...collectMarkdownFiles(child));
		}
	}
	return files;
}

export interface ObsidianSyncEnvOptions {
	app: App;
	api: IOutlineApi;
	/** For single-file sync, pass a resolver that uses app (e.g. from metadataCache). */
	getWikiResolverForSingleFile?: () => (target: string) => string | null;
	resolveConflict?: (title: string) => Promise<"overwrite" | "duplicate" | "cancel">;
	onProgress?: (message: string) => void;
}

export function createObsidianSyncEnv(options: ObsidianSyncEnvOptions): SyncEnv {
	const {
		app,
		api,
		getWikiResolverForSingleFile,
		resolveConflict,
		onProgress,
	} = options;
	let wikiMap: Map<string, string> = new Map();

	return {
		api,
		async listMarkdownFiles(rootPath: string) {
			const folder = app.vault.getAbstractFileByPath(rootPath);
			if (!(folder instanceof TFolder)) return [];
			const files = collectMarkdownFiles(folder);
			return files.map((file) => {
				const relativePath = rootPath ? file.path.slice(rootPath.length).replace(/^\//, "") : file.path;
				return {
					path: file.path,
					basename: file.basename,
					relativePath,
					_file: file,
				} as ObsidianFd;
			});
		},
		async readFile(fd) {
			const file = (fd as ObsidianFd)._file;
			return file ? app.vault.read(file) : "";
		},
		getWikiResolver(filesWithContent) {
			if (filesWithContent) {
				wikiMap = new Map();
				for (const { path: filePath, content } of filesWithContent) {
					const meta = getOutlineMeta(content);
					if (meta.outline_id) {
						const name = filePath.replace(/\.md$/, "").split("/").pop() ?? "";
						wikiMap.set(name, meta.outline_id);
					}
				}
				return (target: string) => wikiMap.get(target) ?? null;
			}
			if (getWikiResolverForSingleFile) {
				return getWikiResolverForSingleFile();
			}
			return (target: string) => wikiMap.get(target) ?? null;
		},
		resolveImage(fd, imageRef) {
			const file = (fd as ObsidianFd)._file;
			if (!file) return null;
			const decoded = decodeURIComponent(imageRef.imageName);
			const imageFile =
				app.metadataCache.getFirstLinkpathDest(decoded, file.path) ??
				app.vault.getAbstractFileByPath(decoded) ??
				app.vault.getAbstractFileByPath(imageRef.imageName);
			if (!(imageFile instanceof TFile)) return null;
			return {
				placeholder: imageRef.placeholder,
				pathOrKey: imageFile.path,
				fileName: imageFile.name,
				contentType: getContentType(imageFile.extension),
			};
		},
		async readImageBytes(pathOrKey: string) {
			const file = app.vault.getAbstractFileByPath(pathOrKey);
			if (!(file instanceof TFile)) throw new Error(`File not found: ${pathOrKey}`);
			return app.vault.readBinary(file);
		},
		async writeFrontmatter(fd, outlineId, collectionId) {
			const file = (fd as ObsidianFd)._file;
			if (!file) return;
			await updateOutlineFrontmatter(app, file, {
				outline_id: outlineId,
				outline_collection_id: collectionId,
				outline_last_synced: new Date().toISOString(),
			});
		},
		resolveConflict,
		onProgress,
	};
}
