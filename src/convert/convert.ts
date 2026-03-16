/**
 * Core markdown conversion (no Obsidian/App). Used by both plugin and CLI.
 */
import {
	runPipeline,
	createContext,
	FrontmatterTransformer,
	CalloutTransformer,
	WikiLinkTransformer,
	ImageDetector,
	TocRemover,
	NewlineNormalizer,
	type ImageRef,
	type TransformerInstance,
} from "../pipeline";

export type WikiLinkResolver = (target: string) => string | null;

export interface ConvertContentOptions {
	removeToc?: boolean;
	outlineUrl?: string;
	preserveUnresolved?: boolean;
}

export interface ConvertContentResult {
	markdown: string;
	imageRefs: ImageRef[];
}

export function convertContentToOutlineMarkdown(
	rawContent: string,
	options: ConvertContentOptions,
	fileName: string,
	filePath: string,
	wikiLinkResolver: WikiLinkResolver,
): ConvertContentResult {
	const ctx = createContext(rawContent, fileName, filePath);
	const transformers: TransformerInstance[] = [
		FrontmatterTransformer(),
		...(options.removeToc ? [TocRemover()] : []),
		ImageDetector(),
		WikiLinkTransformer({
			resolve: wikiLinkResolver,
			outlineUrl: options.outlineUrl,
			preserveUnresolved: options.preserveUnresolved,
		}),
		CalloutTransformer(),
		NewlineNormalizer(),
	];
	const result = runPipeline(ctx, transformers);
	const imageRefs =
		(result.meta.plugins["ImageDetector"]?.["images"] as ImageRef[] | undefined) ?? [];
	return { markdown: result.content, imageRefs };
}
