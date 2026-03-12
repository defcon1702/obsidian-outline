import type { TransformContext, TransformerInstance } from "./types";

export function runPipeline(
	ctx: TransformContext,
	transformers: TransformerInstance[],
): TransformContext {
	return transformers.reduce<TransformContext>(
		(current, transformer) => transformer.transform(current),
		ctx,
	);
}
