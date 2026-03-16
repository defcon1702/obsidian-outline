import { getOutlineMeta } from "../pipeline";

/**
 * Builds a map from document basename (without .md) to its outline_id
 * by parsing frontmatter from each file's content.
 */
export function buildWikiMapFromFiles(
	files: { path: string; content: string }[],
): Map<string, string> {
	const map = new Map<string, string>();
	for (const { path: filePath, content } of files) {
		const meta = getOutlineMeta(content);
		if (meta.outline_id) {
			const name = filePath.replace(/\.md$/, "").split("/").pop() ?? "";
			map.set(name, meta.outline_id);
		}
	}
	return map;
}
