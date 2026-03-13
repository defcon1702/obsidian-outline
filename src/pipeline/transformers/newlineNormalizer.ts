import type { TransformerPlugin, TransformContext } from "../types";

const CODE_FENCE_REGEX = /^(`{3,}|~{3,})/;
const HEADING_REGEX = /^#{1,6}\s/;
const LIST_REGEX = /^\s*[-*+]\s/;
const ORDERED_LIST_REGEX = /^\s*\d+[.)]\s/;
const BLOCKQUOTE_REGEX = /^>/;
const TABLE_REGEX = /^\|/;
const HR_REGEX = /^(---+|\*\*\*+|___+)\s*$/;

function isPlainTextLine(line: string): boolean {
	const trimmed = line.trim();
	if (trimmed === "") return false;
	if (HEADING_REGEX.test(trimmed)) return false;
	if (LIST_REGEX.test(line)) return false;
	if (ORDERED_LIST_REGEX.test(line)) return false;
	if (BLOCKQUOTE_REGEX.test(trimmed)) return false;
	if (TABLE_REGEX.test(trimmed)) return false;
	if (CODE_FENCE_REGEX.test(trimmed)) return false;
	if (HR_REGEX.test(trimmed)) return false;
	return true;
}

/**
 * Obsidian (with "Strict line breaks" OFF, the default) renders a single \n
 * as a visible line break. CommonMark (used by Outline) treats a single \n
 * as a space within the same paragraph, effectively swallowing it.
 *
 * This transformer converts single \n between consecutive plain-text lines
 * into \n\n so Outline renders them as separate paragraphs.
 */
export function normalizeNewlines(content: string): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let inCodeBlock = false;
	let codeFenceMarker = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		const fenceMatch = trimmed.match(CODE_FENCE_REGEX);
		if (fenceMatch) {
			if (!inCodeBlock) {
				inCodeBlock = true;
				codeFenceMarker = fenceMatch[1][0];
			} else if (trimmed.startsWith(codeFenceMarker) && trimmed.replace(/[`~]/g, "").trim() === "") {
				inCodeBlock = false;
				codeFenceMarker = "";
			}
		}

		result.push(line);

		if (
			!inCodeBlock &&
			i < lines.length - 1 &&
			isPlainTextLine(line) &&
			isPlainTextLine(lines[i + 1])
		) {
			result.push("");
		}
	}

	return result.join("\n");
}

export const NewlineNormalizer: TransformerPlugin = () => ({
	name: "NewlineNormalizer",
	transform(ctx: TransformContext): TransformContext {
		return { ...ctx, content: normalizeNewlines(ctx.content) };
	},
});
