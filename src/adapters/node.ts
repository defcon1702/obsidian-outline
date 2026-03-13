import * as fs from "fs";
import * as path from "path";
import { getOutlineMeta } from "../pipeline";
import type { SyncEnv, FileDescriptor, ResolvedImage, ImageRefLike } from "../sync";
import type { IOutlineApi } from "../outline-api/types";

const CONTENT_TYPE_MAP: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	bmp: "image/bmp",
};

function getContentType(filePath: string): string {
	const ext = path.extname(filePath).slice(1).toLowerCase();
	return CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
}

function collectMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectMarkdownFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(full);
		}
	}
	return files;
}

function findFile(dir: string, name: string): string | null {
	try {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name === name) {
				return path.join(dir, entry.name);
			}
			if (
				entry.isDirectory() &&
				entry.name !== "node_modules" &&
				!entry.name.startsWith(".")
			) {
				const found = findFile(path.join(dir, entry.name), name);
				if (found) return found;
			}
		}
	} catch {
		// permission errors etc.
	}
	return null;
}

function resolveImagePath(mdFilePath: string, imageName: string, rootPath: string): string | null {
	const dir = path.dirname(mdFilePath);
	const candidate = path.resolve(dir, imageName);
	if (fs.existsSync(candidate)) return candidate;
	const rootCandidate = path.resolve(rootPath, imageName);
	if (fs.existsSync(rootCandidate)) return rootCandidate;
	const basename = path.basename(imageName);
	return findFile(rootPath, basename);
}

function updateLocalFrontmatter(
	filePath: string,
	outlineId: string,
	outlineCollectionId: string,
): void {
	const rawContent = fs.readFileSync(filePath, "utf-8");
	const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
	const match = fmRegex.exec(rawContent);
	const now = new Date().toISOString();
	const newFields = [
		`outline_id: ${outlineId}`,
		`outline_collection_id: ${outlineCollectionId}`,
		`outline_last_synced: ${now}`,
	];
	if (match) {
		let fmBlock = match[1];
		for (const field of newFields) {
			const key = field.split(":")[0];
			const lineRegex = new RegExp(`^${key}:.*$`, "m");
			if (lineRegex.test(fmBlock)) {
				fmBlock = fmBlock.replace(lineRegex, field);
			} else {
				fmBlock += `\n${field}`;
			}
		}
		const updated = rawContent.replace(fmRegex, `---\n${fmBlock}\n---\n`);
		fs.writeFileSync(filePath, updated, "utf-8");
	} else {
		const fmBlock = `---\n${newFields.join("\n")}\n---\n`;
		fs.writeFileSync(filePath, fmBlock + rawContent, "utf-8");
	}
}

export interface NodeSyncEnvOptions {
	api: IOutlineApi;
	rootPath: string;
	onProgress?: (message: string) => void;
}

export function createNodeSyncEnv(options: NodeSyncEnvOptions): SyncEnv {
	const { api, rootPath, onProgress } = options;
	let wikiMap: Map<string, string> = new Map();

	return {
		api,
		async listMarkdownFiles() {
			const absolutePaths = collectMarkdownFiles(rootPath);
			return absolutePaths.map((p) => {
				const relativePath = path.relative(rootPath, p).replace(/\\/g, "/");
				const basename = path.basename(p, ".md");
				return { path: p, basename, relativePath };
			});
		},
		async readFile(fd) {
			return fs.readFileSync(fd.path, "utf-8");
		},
		getWikiResolver(filesWithContent) {
			if (filesWithContent) {
				wikiMap = new Map();
				for (const { path: filePath, content } of filesWithContent) {
					const meta = getOutlineMeta(content);
					if (meta.outline_id) {
						const name = path.basename(filePath, ".md");
						wikiMap.set(name, meta.outline_id);
					}
				}
				return (target: string) => wikiMap.get(target) ?? null;
			}
			return (target: string) => wikiMap.get(target) ?? null;
		},
		resolveImage(fd, imageRef) {
			const decoded = decodeURIComponent(imageRef.imageName);
			const imgPath = resolveImagePath(fd.path, decoded, rootPath);
			if (!imgPath) return null;
			const fileName = path.basename(imgPath);
			return {
				placeholder: imageRef.placeholder,
				pathOrKey: imgPath,
				fileName,
				contentType: getContentType(imgPath),
			};
		},
		async readImageBytes(pathOrKey) {
			const buf = fs.readFileSync(pathOrKey);
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
		},
		async writeFrontmatter(fd, outlineId, collectionId) {
			updateLocalFrontmatter(fd.path, outlineId, collectionId);
		},
		onProgress,
	};
}
