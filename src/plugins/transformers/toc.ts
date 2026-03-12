import type { TransformerPlugin, TransformContext } from "../types";

const TOC_LINE_REGEX = /^[\t ]*[-*+][\t ]+.*\[\[#[^\]]+\]\]/;
const NUMBERED_TOC_LINE_REGEX = /^[\t ]*\d+[.)]\s+.*\[\[#[^\]]+\]\]/;

function isTocLine(line: string): boolean {
	return TOC_LINE_REGEX.test(line) || NUMBERED_TOC_LINE_REGEX.test(line);
}

export function removeToc(content: string): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		if (!isTocLine(lines[i])) {
			result.push(lines[i]);
			i++;
			continue;
		}

		const blockStart = i;
		while (i < lines.length && (isTocLine(lines[i]) || lines[i].trim() === "")) {
			i++;
		}

		// Trim trailing blank lines that were consumed speculatively
		while (i > blockStart && lines[i - 1].trim() === "") {
			i--;
		}

		// Skip the entire TOC block -- don't push anything for it.
		// But if the block ended with blank lines, keep one separator.
		const nextIsContent = i < lines.length && lines[i].trim() !== "";
		const prevIsContent = result.length > 0 && result[result.length - 1].trim() !== "";
		if (nextIsContent && prevIsContent) {
			result.push("");
		}
	}

	return result.join("\n");
}

export const TocRemover: TransformerPlugin = () => ({
	name: "TocRemover",
	transform(ctx: TransformContext): TransformContext {
		return { ...ctx, content: removeToc(ctx.content) };
	},
});
