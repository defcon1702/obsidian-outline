import type { TransformerPlugin, TransformContext, ImageRef } from "../types";

const EMBEDDED_IMAGE_WIKI_REGEX =
	/!\[\[([^\]|]+\.(png|jpg|jpeg|gif|webp|svg|bmp))(?:\|[^\]]*)?\]\]/gi;
const EMBEDDED_IMAGE_MD_REGEX =
	/!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\)/gi;

export function detectImages(content: string): {
	content: string;
	images: ImageRef[];
} {
	const images: ImageRef[] = [];
	let result = content;

	const wikiMatches = [...result.matchAll(EMBEDDED_IMAGE_WIKI_REGEX)];
	for (const match of wikiMatches) {
		const placeholder = `__OUTLINE_IMG_${images.length}__`;
		images.push({
			originalSyntax: match[0],
			imageName: match[1],
			placeholder,
		});
		result = result.replace(match[0], placeholder);
	}

	const mdMatches = [...result.matchAll(EMBEDDED_IMAGE_MD_REGEX)];
	for (const match of mdMatches) {
		const placeholder = `__OUTLINE_IMG_${images.length}__`;
		images.push({
			originalSyntax: match[0],
			imageName: match[2],
			placeholder,
		});
		result = result.replace(match[0], placeholder);
	}

	return { content: result, images };
}

export const ImageDetector: TransformerPlugin = () => ({
	name: "ImageDetector",
	transform(ctx: TransformContext): TransformContext {
		const { content, images } = detectImages(ctx.content);
		return {
			...ctx,
			content,
			meta: {
				...ctx.meta,
				plugins: {
					...ctx.meta.plugins,
					ImageDetector: { images },
				},
			},
		};
	},
});
