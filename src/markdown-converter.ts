import { App, TFile, Vault } from "obsidian";
import {
	runPipeline,
	createContext,
	FrontmatterTransformer,
	CalloutTransformer,
	WikiLinkTransformer,
	ImageDetector,
	TocRemover,
	NewlineNormalizer,
	getOutlineMeta,
	type ImageRef,
	type WikiLinkResolver,
	type TransformerInstance,
} from "./pipeline";

export interface EmbeddedImage {
	obsidianPath: string;
	placeholder: string;
}

export interface ConvertResult {
	markdown: string;
	images: EmbeddedImage[];
}

export interface ConvertOptions {
	removeToc?: boolean;
}

export async function convertToOutlineMarkdown(
	app: App,
	file: TFile,
	rawContent: string,
	options?: ConvertOptions,
): Promise<ConvertResult> {
	const wikiLinkResolver = buildWikiLinkResolver(app);

	const ctx = createContext(rawContent, file.basename, file.path);

	const transformers: TransformerInstance[] = [
		FrontmatterTransformer(),
		...(options?.removeToc ? [TocRemover()] : []),
		ImageDetector(),
		WikiLinkTransformer({ resolve: wikiLinkResolver }),
		CalloutTransformer(),
		NewlineNormalizer(),
	];

	const result = runPipeline(ctx, transformers);

	const detectedImages =
		(result.meta.plugins["ImageDetector"]?.["images"] as ImageRef[] | undefined) ?? [];

	const images = resolveImagePaths(app, file, detectedImages);

	return { markdown: result.content, images };
}

export async function resolveWikiLinksWithCache(
	app: App,
	content: string,
	fileContentCache: Map<string, string>,
): Promise<string> {
	const resolver = buildWikiLinkResolverWithCache(app, fileContentCache);

	const ctx = createContext(content);
	const result = runPipeline(ctx, [
		WikiLinkTransformer({ resolve: resolver }),
	]);

	return result.content;
}

export function buildWikiLinkResolver(app: App): WikiLinkResolver {
	return (linkTarget: string) => {
		const targetFile = app.metadataCache.getFirstLinkpathDest(linkTarget, "");
		if (targetFile instanceof TFile) {
			const cachedContent = (
				app.vault as Vault & { readCache?: Map<string, string> }
			).readCache?.get(targetFile.path);
			if (cachedContent) {
				const meta = getOutlineMeta(cachedContent);
				if (meta.outline_id) return meta.outline_id;
			}
		}
		return null;
	};
}

function buildWikiLinkResolverWithCache(
	app: App,
	fileContentCache: Map<string, string>,
): WikiLinkResolver {
	return (linkTarget: string) => {
		const targetFile = app.metadataCache.getFirstLinkpathDest(linkTarget, "");
		if (targetFile instanceof TFile) {
			const cachedContent = fileContentCache.get(targetFile.path);
			if (cachedContent) {
				const meta = getOutlineMeta(cachedContent);
				if (meta.outline_id) return meta.outline_id;
			}
		}
		return null;
	};
}

function resolveImagePaths(
	app: App,
	sourceFile: TFile,
	detected: ImageRef[],
): EmbeddedImage[] {
	const images: EmbeddedImage[] = [];

	for (const ref of detected) {
		const decoded = decodeURIComponent(ref.imageName);
		const imageFile =
			app.metadataCache.getFirstLinkpathDest(decoded, sourceFile.path) ??
			app.vault.getAbstractFileByPath(decoded) ??
			app.vault.getAbstractFileByPath(ref.imageName);

		if (imageFile instanceof TFile) {
			images.push({ obsidianPath: imageFile.path, placeholder: ref.placeholder });
		}
	}

	return images;
}
