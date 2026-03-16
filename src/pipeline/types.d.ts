export interface ImageRef {
  originalSyntax: string;
  imageName: string;
  placeholder: string;
}

export interface TransformContext {
  content: string;
  meta: {
    fileName: string;
    filePath: string;
    frontmatter: Record<string, unknown>;
    plugins: Record<string, Record<string, unknown>>;
  };
}

export interface TransformerInstance {
  name: string;
  transform(ctx: TransformContext): TransformContext;
}

export type TransformerPlugin<Options = void> = (opts?: Options) => TransformerInstance;
