const CONTENT_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

export function getContentType(ext: string): string {
  return CONTENT_TYPE_MAP[ext.toLowerCase()] ?? 'application/octet-stream';
}
