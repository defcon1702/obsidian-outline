import type { TransformerPlugin, TransformContext } from "../types";

const WIKI_LINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?([^\]]*)\]\]/g;
const UNRESOLVED_MARKER_RE = /%%WIKILINK\[([^\]|]*)\|([^\]]*)\]%%/g;

export type WikiLinkResolver = (linkTarget: string) => string | null;

export interface WikiLinkOptions {
	resolve: WikiLinkResolver;
	outlineUrl?: string;
	/** When true, unresolved links are kept as markers instead of plain text. */
	preserveUnresolved?: boolean;
}

const defaultOptions: WikiLinkOptions = {
	resolve: () => null,
};

function buildHref(outlineId: string, outlineUrl?: string): string {
	const base = outlineUrl?.replace(/\/$/, "");
	return base ? `${base}/doc/${outlineId}` : `/doc/${outlineId}`;
}

export function replaceWikiLinks(
	content: string,
	resolve: WikiLinkResolver,
	outlineUrl?: string,
	preserveUnresolved = false,
): string {
	return content.replace(
		WIKI_LINK_REGEX,
		(_match, linkTarget: string, alias: string) => {
			const displayText = alias.trim() || linkTarget.trim();
			const outlineId = resolve(linkTarget.trim());
			if (outlineId) {
				return `[${displayText}](${buildHref(outlineId, outlineUrl)})`;
			}
			if (preserveUnresolved) {
				return `%%WIKILINK[${linkTarget.trim()}|${displayText}]%%`;
			}
			return displayText;
		},
	);
}

/**
 * Replace `%%WIKILINK[target|display]%%` markers with resolved links.
 * Markers that still can't be resolved become plain display text.
 */
export function resolveWikiLinkMarkers(
	content: string,
	resolve: WikiLinkResolver,
	outlineUrl?: string,
): string {
	return content.replace(
		UNRESOLVED_MARKER_RE,
		(_match, target: string, display: string) => {
			const outlineId = resolve(target.trim());
			if (outlineId) {
				return `[${display}](${buildHref(outlineId, outlineUrl)})`;
			}
			return display;
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
			return {
				...ctx,
				content: replaceWikiLinks(ctx.content, opts.resolve, opts.outlineUrl, opts.preserveUnresolved),
			};
		},
	};
};
