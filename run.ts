import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
	runPipeline,
	createContext,
	FrontmatterTransformer,
	CalloutTransformer,
	WikiLinkTransformer,
	ImageDetector,
	TocRemover,
	getOutlineMeta,
	buildDocumentTree,
	type ImageRef,
	type DocNode,
} from "./src/plugins";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OUTLINE_URL = required("OUTLINE_URL");
const OUTLINE_API_KEY = required("OUTLINE_API_KEY");
const OBSIDIAN_FOLDER = required("OBSIDIAN_FOLDER");
const OUTLINE_COLLECTION_ID = process.env["OUTLINE_COLLECTION_ID"]?.trim() ?? "";
const INDEX_AS_FOLDER = (process.env["INDEX_AS_FOLDER"]?.trim() ?? "true").toLowerCase() !== "false";
const REMOVE_TOC = (process.env["REMOVE_TOC"]?.trim() ?? "false").toLowerCase() === "true";

function required(key: string): string {
	const val = process.env[key]?.trim();
	if (!val) {
		console.error(`Missing required env var: ${key}`);
		process.exit(1);
	}
	return val;
}

// ---------------------------------------------------------------------------
// Minimal Outline API client (Node fetch, no Obsidian dependency)
// ---------------------------------------------------------------------------

async function outlinePost<T>(
	endpoint: string,
	body: Record<string, unknown> = {},
): Promise<T | null> {
	const maxRetries = 3;
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const res = await fetch(`${OUTLINE_URL}/api/${endpoint}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${OUTLINE_API_KEY}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(body),
		});

		if (res.status === 429) {
			const retryAfter = Math.min(
				parseInt(res.headers.get("retry-after") ?? "5", 10) || 5,
				60,
			);
			console.log(`  Rate limited, waiting ${retryAfter}s…`);
			await sleep(retryAfter * 1000);
			continue;
		}

		if (!res.ok) {
			console.error(
				`  API error ${res.status} on ${endpoint}: ${await res.text()}`,
			);
			return null;
		}

		return (await res.json()) as T;
	}
	return null;
}

async function uploadImage(
	filePath: string,
	documentId: string,
): Promise<string | null> {
	const name = path.basename(filePath);
	const ext = path.extname(filePath).slice(1).toLowerCase();
	const contentTypeMap: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		bmp: "image/bmp",
	};
	const contentType = contentTypeMap[ext] ?? "application/octet-stream";
	const fileData = fs.readFileSync(filePath);

	const attachRes = await outlinePost<{
		data: {
			uploadUrl: string;
			form: Record<string, string>;
			attachment: { id: string; url: string };
		};
	}>("attachments.create", {
		name,
		contentType,
		size: fileData.byteLength,
		documentId,
	});
	if (!attachRes) return null;

	const { uploadUrl, form, attachment } = attachRes.data;
	const absoluteUrl = uploadUrl.startsWith("http")
		? uploadUrl
		: `${OUTLINE_URL}${uploadUrl.startsWith("/") ? "" : "/"}${uploadUrl}`;

	const formData = new FormData();
	for (const [key, value] of Object.entries(form)) {
		formData.append(key, value);
	}
	formData.append(
		"file",
		new Blob([new Uint8Array(fileData)], { type: contentType }),
		name,
	);

	const headers: Record<string, string> = {};
	if (!uploadUrl.startsWith("http")) {
		headers["Authorization"] = `Bearer ${OUTLINE_API_KEY}`;
	}

	const uploadRes = await fetch(absoluteUrl, {
		method: "POST",
		headers,
		body: formData,
	});

	if (!uploadRes.ok) {
		console.error(`  Image upload failed for ${name}: ${uploadRes.status}`);
		return null;
	}

	return attachment.url;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Wiki link resolver: builds a map of fileName -> outline_id from frontmatter
// ---------------------------------------------------------------------------

function buildWikiLinkMap(
	files: { filePath: string; rawContent: string }[],
): (target: string) => string | null {
	const map = new Map<string, string>();
	for (const f of files) {
		const meta = getOutlineMeta(f.rawContent);
		if (meta.outline_id) {
			const name = path.basename(f.filePath, ".md");
			map.set(name, meta.outline_id);
		}
	}
	return (target) => map.get(target) ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log("Outline Sync CLI");
	console.log(`  URL:    ${OUTLINE_URL}`);
	console.log(`  Folder: ${OBSIDIAN_FOLDER}`);
	console.log();

	// Validate auth
	const authRes = await outlinePost<{
		data: { user: { id: string; name: string } };
	}>("auth.info");
	if (!authRes?.data?.user?.id) {
		console.error("Authentication failed. Check OUTLINE_URL and OUTLINE_API_KEY.");
		process.exit(1);
	}
	console.log(`Authenticated as: ${authRes.data.user.name}`);

	// Resolve collection — always fetch the list so we can resolve slugs/names
	const colRes = await outlinePost<{
		data: { id: string; name: string; urlId: string }[];
	}>("collections.list", { limit: 100 });
	const collections = colRes?.data;
	if (!collections || collections.length === 0) {
		console.error("No collections found.");
		process.exit(1);
	}

	let collectionId = "";
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	if (OUTLINE_COLLECTION_ID) {
		if (uuidRegex.test(OUTLINE_COLLECTION_ID)) {
			collectionId = OUTLINE_COLLECTION_ID;
		} else {
			const match = collections.find(
				(c) =>
					c.urlId === OUTLINE_COLLECTION_ID ||
					c.name.toLowerCase() === OUTLINE_COLLECTION_ID.toLowerCase(),
			);
			if (match) {
				collectionId = match.id;
				console.log(`Resolved "${OUTLINE_COLLECTION_ID}" → ${match.name} (${match.id})`);
			}
		}
	}

	if (!collectionId) {
		console.log("\nAvailable collections:");
		collections.forEach((c, i) =>
			console.log(`  ${i + 1}. ${c.name}  (id: ${c.id}, slug: ${c.urlId})`),
		);
		console.log(
			"\nSet OUTLINE_COLLECTION_ID in .env to a UUID, slug, or name from the list above.",
		);
		process.exit(1);
	}

	console.log(`Target collection: ${collectionId}\n`);

	// Discover files
	if (!fs.existsSync(OBSIDIAN_FOLDER)) {
		console.error(`\nERROR: Folder not found: "${OBSIDIAN_FOLDER}"`);
		console.error("Check OBSIDIAN_FOLDER in .env — use an absolute path without quotes.");
		process.exit(1);
	}
	const mdPaths = collectMarkdownFiles(OBSIDIAN_FOLDER);
	console.log(`Found ${mdPaths.length} markdown file(s)`);
	console.log(`Index as folder: ${INDEX_AS_FOLDER}\n`);
	if (mdPaths.length === 0) return;

	// Read all files (needed for wiki link resolution across files)
	const fileContentMap = new Map<string, string>();
	const allFiles: { filePath: string; rawContent: string }[] = [];
	for (const fp of mdPaths) {
		const raw = fs.readFileSync(fp, "utf-8");
		fileContentMap.set(fp, raw);
		allFiles.push({ filePath: fp, rawContent: raw });
	}
	const wikiResolver = buildWikiLinkMap(allFiles);

	// Build the document tree from relative paths
	const relativePaths = mdPaths.map((fp) => path.relative(OBSIDIAN_FOLDER, fp));
	const tree = buildDocumentTree(relativePaths, { indexAsFolder: INDEX_AS_FOLDER });

	const counter = { success: 0, failed: 0 };

	async function syncNode(
		node: DocNode,
		parentDocumentId: string | undefined,
	): Promise<void> {
		const absolutePath = node.filePath
			? path.resolve(OBSIDIAN_FOLDER, node.filePath)
			: null;

		const rawContent = absolutePath ? fileContentMap.get(absolutePath) ?? null : null;
		const indent = "  ".repeat(node.relativePath.split("/").length - 1);
		process.stdout.write(`${indent}${node.isFolder ? "[D] " : ""}${node.title}… `);

		try {
			let markdown = "";
			let images: ImageRef[] = [];

			if (rawContent) {
				const ctx = createContext(
					rawContent,
					node.title,
					absolutePath!,
				);
			const transformers = [
				FrontmatterTransformer(),
				...(REMOVE_TOC ? [TocRemover()] : []),
				ImageDetector(),
				WikiLinkTransformer({ resolve: wikiResolver }),
				CalloutTransformer(),
			];
			const result = runPipeline(ctx, transformers);
				markdown = result.content;
				images = (result.meta.plugins["ImageDetector"]?.["images"] as ImageRef[] | undefined) ?? [];
			}

			// Search for existing document with same title under the same parent
			const searchRes = await outlinePost<{
				data: { document: { id: string; title: string; collectionId: string; parentDocumentId: string | null } }[];
			}>("documents.search", {
				query: node.title,
				collectionId,
				limit: 25,
			});
			const existingInCollection = searchRes?.data?.find(
				(r) =>
					r.document.title.toLowerCase() === node.title.toLowerCase() &&
					r.document.collectionId === collectionId &&
					(r.document.parentDocumentId ?? undefined) === parentDocumentId,
			);

			let documentId: string;

			if (existingInCollection) {
				const updated = await outlinePost<{ data: { id: string } }>(
					"documents.update",
					{
						id: existingInCollection.document.id,
						title: node.title,
						text: markdown,
						publish: true,
					},
				);
				if (!updated) throw new Error("Update failed");
				documentId = updated.data.id;
				process.stdout.write("updated");
			} else {
				const createPayload: Record<string, unknown> = {
					title: node.title,
					text: markdown,
					collectionId,
					publish: true,
				};
				if (parentDocumentId) {
					createPayload.parentDocumentId = parentDocumentId;
				}
				const created = await outlinePost<{ data: { id: string } }>(
					"documents.create",
					createPayload,
				);
				if (!created) throw new Error("Create failed");
				documentId = created.data.id;
				process.stdout.write("created");
			}

			// Upload images
			if (images.length > 0 && absolutePath) {
				let imgMarkdown = markdown;
				let uploaded = 0;

				for (const img of images) {
					const decoded = decodeURIComponent(img.imageName);
					const imgPath = resolveImagePath(absolutePath, decoded);
					if (!imgPath) {
						imgMarkdown = imgMarkdown.replace(
							img.placeholder,
							`*(Image not found: ${img.imageName})*`,
						);
						continue;
					}

					const url = await uploadImage(imgPath, documentId);
					if (url) {
						const alt = path.basename(img.imageName, path.extname(img.imageName));
						imgMarkdown = imgMarkdown.replace(
							img.placeholder,
							`![${alt}](${url})`,
						);
						uploaded++;
					} else {
						imgMarkdown = imgMarkdown.replace(
							img.placeholder,
							`*(Upload failed: ${img.imageName})*`,
						);
					}
				}

				if (uploaded > 0) {
					await outlinePost("documents.update", {
						id: documentId,
						title: node.title,
						text: imgMarkdown,
						publish: true,
					});
				}
				process.stdout.write(` (${uploaded}/${images.length} images)`);
			}

			if (absolutePath && rawContent) {
				updateLocalFrontmatter(absolutePath, rawContent, documentId, collectionId);
			}

			console.log(" ✓");
			counter.success++;

			// Recurse into children with this document as parent
			for (const child of node.children) {
				await syncNode(child, documentId);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.log(` ✗ ${msg}`);
			counter.failed++;
		}
	}

	for (const rootNode of tree) {
		await syncNode(rootNode, undefined);
	}

	console.log(
		`\nDone: ${counter.success} pushed, ${counter.failed} failed (${mdPaths.length} total)`,
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveImagePath(
	mdFilePath: string,
	imageName: string,
): string | null {
	// Try relative to the markdown file
	const dir = path.dirname(mdFilePath);
	const candidate = path.resolve(dir, imageName);
	if (fs.existsSync(candidate)) return candidate;

	// Try relative to vault root
	const rootCandidate = path.resolve(OBSIDIAN_FOLDER, imageName);
	if (fs.existsSync(rootCandidate)) return rootCandidate;

	// Search recursively from vault root for the basename
	const basename = path.basename(imageName);
	const found = findFile(OBSIDIAN_FOLDER, basename);
	return found;
}

function findFile(dir: string, name: string): string | null {
	try {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name === name) {
				return path.join(dir, entry.name);
			}
			if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
				const found = findFile(path.join(dir, entry.name), name);
				if (found) return found;
			}
		}
	} catch {
		// permission errors etc.
	}
	return null;
}

function updateLocalFrontmatter(
	filePath: string,
	rawContent: string,
	outlineId: string,
	outlineCollectionId: string,
): void {
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
		const updated = rawContent.replace(
			fmRegex,
			`---\n${fmBlock}\n---\n`,
		);
		fs.writeFileSync(filePath, updated, "utf-8");
	} else {
		const fmBlock = `---\n${newFields.join("\n")}\n---\n`;
		fs.writeFileSync(filePath, fmBlock + rawContent, "utf-8");
	}
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

main().catch((e) => {
	console.error("Fatal error:", e);
	process.exit(1);
});
