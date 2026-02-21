import { App, TFile, Vault } from "obsidian";
import { getOutlineMeta, stripFrontmatter } from "./frontmatter";

export interface EmbeddedImage {
	obsidianPath: string;
	placeholder: string;
}

export interface ConvertResult {
	markdown: string;
	images: EmbeddedImage[];
}

const WIKI_LINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?([^\]]*)\]\]/g;
const EMBEDDED_IMAGE_WIKI_REGEX = /!\[\[([^\]|]+\.(png|jpg|jpeg|gif|webp|svg|bmp))(?:\|[^\]]*)?\]\]/gi;
const EMBEDDED_IMAGE_MD_REGEX = /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\)/gi;
const CALLOUT_REGEX = /^> \[!(\w+)\]([-+]?)[ \t]*(.*)/gm;

export async function convertToOutlineMarkdown(
	app: App,
	file: TFile,
	rawContent: string
): Promise<ConvertResult> {
	let markdown = stripFrontmatter(rawContent);
	const images: EmbeddedImage[] = [];

	markdown = await resolveEmbeddedImages(app, file, markdown, images);
	markdown = await resolveWikiLinks(app, markdown);
	markdown = convertCallouts(markdown);

	return { markdown, images };
}

async function resolveEmbeddedImages(
	app: App,
	sourceFile: TFile,
	content: string,
	images: EmbeddedImage[]
): Promise<string> {
	const wikiMatches = [...content.matchAll(EMBEDDED_IMAGE_WIKI_REGEX)];
	const mdMatches = [...content.matchAll(EMBEDDED_IMAGE_MD_REGEX)];
	console.log(`[Outline Sync] Image detection – wiki: ${wikiMatches.length}, markdown: ${mdMatches.length}`);

	for (const match of wikiMatches) {
		const imageName = match[1];
		const placeholder = `__OUTLINE_IMG_${images.length}__`;
		const imageFile = app.metadataCache.getFirstLinkpathDest(imageName, sourceFile.path);
		if (imageFile instanceof TFile) {
			images.push({ obsidianPath: imageFile.path, placeholder });
			content = content.replace(match[0], placeholder);
		} else {
			content = content.replace(match[0], `*(Bild nicht gefunden: ${imageName})*`);
		}
	}

	for (const match of mdMatches) {
		const rawPath = match[2];
		const placeholder = `__OUTLINE_IMG_${images.length}__`;
		const decoded = decodeURIComponent(rawPath);
		const imageFile =
			app.metadataCache.getFirstLinkpathDest(decoded, sourceFile.path) ??
			app.vault.getAbstractFileByPath(decoded) ??
			app.vault.getAbstractFileByPath(rawPath);
		if (imageFile instanceof TFile) {
			images.push({ obsidianPath: imageFile.path, placeholder });
			content = content.replace(match[0], placeholder);
		} else {
			content = content.replace(match[0], `*(Bild nicht gefunden: ${rawPath})*`);
		}
	}

	return content;
}

async function resolveWikiLinks(app: App, content: string): Promise<string> {
	const resolved = content.replace(WIKI_LINK_REGEX, (_match, linkTarget: string, alias: string) => {
		const displayText = alias.trim() || linkTarget.trim();
		const targetFile = app.metadataCache.getFirstLinkpathDest(linkTarget.trim(), "");

		if (targetFile instanceof TFile) {
			const cache = app.vault.cachedRead(targetFile);
			void cache.then(async (rawContent) => {
				const meta = getOutlineMeta(rawContent);
				if (meta.outline_id) {
					return `[${displayText}](doc:${meta.outline_id})`;
				}
			});

			const cachedContent = (app.vault as Vault & { readCache?: Map<string, string> }).readCache?.get(targetFile.path);
			if (cachedContent) {
				const meta = getOutlineMeta(cachedContent);
				if (meta.outline_id) {
					return `[${displayText}](doc:${meta.outline_id})`;
				}
			}
		}

		return displayText;
	});

	return resolved;
}

export async function resolveWikiLinksWithCache(
	app: App,
	content: string,
	fileContentCache: Map<string, string>
): Promise<string> {
	return content.replace(WIKI_LINK_REGEX, (_match, linkTarget: string, alias: string) => {
		const displayText = alias.trim() || linkTarget.trim();
		const targetFile = app.metadataCache.getFirstLinkpathDest(linkTarget.trim(), "");

		if (targetFile instanceof TFile) {
			const cachedContent = fileContentCache.get(targetFile.path);
			if (cachedContent) {
				const meta = getOutlineMeta(cachedContent);
				if (meta.outline_id) {
					return `[${displayText}](doc:${meta.outline_id})`;
				}
			}
		}

		return displayText;
	});
}

function convertCallouts(content: string): string {
	return content.replace(CALLOUT_REGEX, (_match, type: string, _foldable: string, title: string) => {
		const label = title.trim() || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		return `> **${label}**`;
	});
}
