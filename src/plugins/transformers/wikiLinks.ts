import type { TransformerPlugin, TransformContext } from "../types";

const WIKI_LINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?([^\]]*)\]\]/g;

export type WikiLinkResolver = (linkTarget: string) => string | null;

export interface WikiLinkOptions {
	resolve: WikiLinkResolver;
}

const defaultOptions: WikiLinkOptions = {
	resolve: () => null,
};

export function replaceWikiLinks(
	content: string,
	resolve: WikiLinkResolver,
): string {
	return content.replace(
		WIKI_LINK_REGEX,
		(_match, linkTarget: string, alias: string) => {
			const displayText = alias.trim() || linkTarget.trim();
			const outlineId = resolve(linkTarget.trim());
			if (outlineId) {
				return `[${displayText}](doc:${outlineId})`;
			}
			return displayText;
		},
	);
}

export const WikiLinkTransformer: TransformerPlugin<WikiLinkOptions> = (
	userOpts,
) => {
	const opts = { ...defaultOptions, ...userOpts };
	return {
		name: "WikiLinkTransformer",
		transform(ctx: TransformContext): TransformContext {
			return { ...ctx, content: replaceWikiLinks(ctx.content, opts.resolve) };
		},
	};
};
