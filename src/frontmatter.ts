import { App, TFile } from "obsidian";
import type { OutlineFrontmatter } from "./plugins";

export { parseFrontmatter, stripFrontmatter, getOutlineMeta } from "./plugins";
export type { OutlineFrontmatter } from "./plugins";

export async function updateOutlineFrontmatter(
	app: App,
	file: TFile,
	updates: OutlineFrontmatter,
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (updates.outline_id !== undefined) fm["outline_id"] = updates.outline_id;
		if (updates.outline_collection_id !== undefined)
			fm["outline_collection_id"] = updates.outline_collection_id;
		if (updates.outline_last_synced !== undefined)
			fm["outline_last_synced"] = updates.outline_last_synced;
	});
}
