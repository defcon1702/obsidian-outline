import type { TransformContext } from './types';

export function createContext(content: string, fileName = '', filePath = ''): TransformContext {
  return {
    content,
    meta: {
      fileName,
      filePath,
      frontmatter: {},
      plugins: {},
    },
  };
}
