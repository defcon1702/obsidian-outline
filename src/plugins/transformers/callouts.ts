import type { TransformerPlugin, TransformContext } from "../types";

const CALLOUT_OPEN_REGEX = /^> \[!(\w+)\]([-+]?)[ \t]*(.*)$/;

const OBSIDIAN_TO_OUTLINE_TYPE: Record<string, string> = {
	note: "info",
	abstract: "info",
	info: "info",
	tip: "tip",
	success: "success",
	question: "info",
	warning: "warning",
	failure: "warning",
	danger: "warning",
	bug: "warning",
	example: "tip",
	quote: "info",
	cite: "info",
};

export function convertCallouts(content: string): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const openMatch = lines[i].match(CALLOUT_OPEN_REGEX);
		if (!openMatch) {
			result.push(lines[i]);
			i++;
			continue;
		}

		const obsidianType = openMatch[1].toLowerCase();
		const titlePart = openMatch[3].trim();
		const outlineType = OBSIDIAN_TO_OUTLINE_TYPE[obsidianType] ?? "info";

		const bodyLines: string[] = [];
		if (titlePart) {
			bodyLines.push(titlePart);
		}
		i++;

		while (i < lines.length && lines[i].startsWith(">")) {
			const rest = lines[i].replace(/^> ?/, "");
			bodyLines.push(rest);
			i++;
		}

		const body = bodyLines.join("\n").trim();
		result.push(`:::${outlineType}`);
		if (body) {
			result.push(body);
		}
		result.push("");
		result.push(":::");
	}

	return result.join("\n");
}

export const CalloutTransformer: TransformerPlugin = () => ({
	name: "CalloutTransformer",
	transform(ctx: TransformContext): TransformContext {
		return { ...ctx, content: convertCallouts(ctx.content) };
	},
});
