import type { IOutlineApi } from "../outline-api/types";

export type ConflictResolution = "overwrite" | "duplicate" | "cancel";

export interface SyncOptions {
	outlineUrl: string;
	apiKey: string;
	collectionId: string;
	removeToc: boolean;
	indexAsFolder: boolean;
	/** Used when no UI (e.g. CLI); ignored when resolveConflict is provided. */
	folderConflictStrategy: "overwrite" | "duplicate";
	/** When true, unresolved wiki links are kept as markers for two-pass resolution. */
	preserveUnresolved?: boolean;
}

export interface SyncResult {
	success: number;
	failed: number;
	total: number;
}

export interface SyncDocumentResult {
	documentId: string;
	collectionId: string;
	action: "created" | "updated";
	imageStats?: { uploaded: number; total: number };
	/** Final markdown sent to Outline (used for two-pass wiki link resolution). */
	finalMarkdown?: string;
}

export interface FileDescriptor {
	/** Canonical path (vault path for Obsidian, absolute path for Node). */
	path: string;
	basename: string;
	relativePath?: string;
}

/** Minimal image ref (from conversion pipeline) for resolving. */
export interface ImageRefLike {
	imageName: string;
	placeholder: string;
}

/** Resolved image for upload: path/key to read bytes + metadata. */
export interface ResolvedImage {
	placeholder: string;
	/** Path or key for env.readImageBytes. */
	pathOrKey: string;
	fileName: string;
	contentType: string;
}

export interface SyncEnv {
	api: IOutlineApi;
	listMarkdownFiles(rootPath: string): Promise<FileDescriptor[]>;
	readFile(fd: FileDescriptor): Promise<string>;
	/** For folder sync pass all files with content to resolve wiki links across the vault. */
	getWikiResolver(filesWithContent?: { path: string; content: string }[]): (target: string) => string | null;
	/** Resolve image ref to path/key and metadata; return null if not found. */
	resolveImage(fd: FileDescriptor, imageRef: ImageRefLike): ResolvedImage | null;
	readImageBytes(pathOrKey: string): Promise<ArrayBuffer>;
	writeFrontmatter(
		fd: FileDescriptor,
		outlineId: string,
		collectionId: string,
	): Promise<void>;
	/** Optional; when missing, use options.folderConflictStrategy for folder sync. */
	resolveConflict?(title: string): Promise<ConflictResolution>;
	onProgress?(message: string): void;
}
