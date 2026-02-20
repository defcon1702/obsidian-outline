import { App, TFile } from "obsidian";

export interface OutlineFrontmatter {
	outline_id?: string;
	outline_collection_id?: string;
	outline_last_synced?: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
	const match = FRONTMATTER_REGEX.exec(content);
	if (!match) {
		return { meta: {}, body: content };
	}

	const meta: Record<string, unknown> = {};
	const raw = match[1];

	for (const line of raw.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (!key) continue;
		if (value === "true") meta[key] = true;
		else if (value === "false") meta[key] = false;
		else if (value !== "" && !isNaN(Number(value))) meta[key] = Number(value);
		else meta[key] = value.replace(/^["']|["']$/g, "");
	}

	const body = content.slice(match[0].length);
	return { meta, body };
}

export function stripFrontmatter(content: string): string {
	return content.replace(FRONTMATTER_REGEX, "");
}

export async function updateOutlineFrontmatter(
	app: App,
	file: TFile,
	updates: OutlineFrontmatter
): Promise<void> {
	const content = await app.vault.read(file);
	const { meta, body } = parseFrontmatter(content);

	const merged: Record<string, unknown> = { ...meta, ...updates };

	const lines: string[] = [];
	for (const [key, value] of Object.entries(merged)) {
		if (value === undefined || value === null || value === "") continue;
		lines.push(`${key}: ${String(value)}`);
	}

	const newContent = `---\n${lines.join("\n")}\n---\n${body}`;
	await app.vault.modify(file, newContent);
}

export function getOutlineMeta(content: string): OutlineFrontmatter {
	const { meta } = parseFrontmatter(content);
	return {
		outline_id: meta["outline_id"] as string | undefined,
		outline_collection_id: meta["outline_collection_id"] as string | undefined,
		outline_last_synced: meta["outline_last_synced"] as string | undefined,
	};
}
