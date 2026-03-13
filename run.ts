import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { OutlineClientNode } from "./src/outline-api";
import { syncFolder } from "./src/sync";
import { createNodeSyncEnv } from "./src/adapters/node";

const OUTLINE_URL = required("OUTLINE_URL");
const OUTLINE_API_KEY = required("OUTLINE_API_KEY");
const OBSIDIAN_FOLDER = required("OBSIDIAN_FOLDER");
const OUTLINE_COLLECTION_ID = process.env["OUTLINE_COLLECTION_ID"]?.trim() ?? "";
const INDEX_AS_FOLDER = (process.env["INDEX_AS_FOLDER"]?.trim() ?? "true").toLowerCase() !== "false";
const REMOVE_TOC = (process.env["REMOVE_TOC"]?.trim() ?? "false").toLowerCase() === "true";
const FOLDER_CONFLICT_STRATEGY =
	(process.env["FOLDER_CONFLICT_STRATEGY"]?.trim()?.toLowerCase() === "duplicate"
		? "duplicate"
		: "overwrite") as "overwrite" | "duplicate";

function required(key: string): string {
	const val = process.env[key]?.trim();
	if (!val) {
		console.error(`Missing required env var: ${key}`);
		process.exit(1);
	}
	return val;
}

async function main() {
	console.log("Outline Sync CLI");
	console.log(`  URL:    ${OUTLINE_URL}`);
	console.log(`  Folder: ${OBSIDIAN_FOLDER}`);
	console.log();

	const api = new OutlineClientNode(OUTLINE_URL, OUTLINE_API_KEY);

	const authUser = await api.validateAuth();
	if (!authUser) {
		console.error("Authentication failed. Check OUTLINE_URL and OUTLINE_API_KEY.");
		process.exit(1);
	}
	console.log(`Authenticated as: ${authUser}`);

	const collections = await api.listCollections();
	if (!collections?.length) {
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
					c.name?.toLowerCase() === OUTLINE_COLLECTION_ID.toLowerCase(),
			);
			if (match?.id) {
				collectionId = match.id;
				console.log(`Resolved "${OUTLINE_COLLECTION_ID}" → ${match.name}`);
			}
		}
	}
	if (!collectionId) {
		console.log("\nAvailable collections:");
		collections.forEach((c, i) =>
			console.log(`  ${i + 1}. ${c.name ?? "—"}  (id: ${c.id ?? "—"}, slug: ${c.urlId ?? "—"})`),
		);
		console.log("\nSet OUTLINE_COLLECTION_ID in .env to a UUID, slug, or name from the list above.");
		process.exit(1);
	}

	console.log(`Target collection: ${collectionId}\n`);

	if (!fs.existsSync(OBSIDIAN_FOLDER)) {
		console.error(`\nERROR: Folder not found: "${OBSIDIAN_FOLDER}"`);
		console.error("Check OBSIDIAN_FOLDER in .env — use an absolute path without quotes.");
		process.exit(1);
	}

	const options = {
		outlineUrl: OUTLINE_URL,
		apiKey: OUTLINE_API_KEY,
		collectionId,
		removeToc: REMOVE_TOC,
		indexAsFolder: INDEX_AS_FOLDER,
		folderConflictStrategy: FOLDER_CONFLICT_STRATEGY,
	};

	const env = createNodeSyncEnv({
		api,
		rootPath: OBSIDIAN_FOLDER,
		onProgress: (msg) => process.stdout.write(msg + "\n"),
	});

	const result = await syncFolder(options, env, OBSIDIAN_FOLDER);
	console.log(`\nDone: ${result.success} pushed, ${result.failed} failed (${result.total} total)`);
}

main().catch((e) => {
	console.error("Fatal error:", e);
	process.exit(1);
});
