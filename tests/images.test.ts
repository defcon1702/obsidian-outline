import {
  detectImages,
  ImageDetector,
  createContext,
  runPipeline,
  type ImageRef,
} from '../src/pipeline';

describe('detectImages', () => {
  it('detects wiki-style image embed', () => {
    const { content, images } = detectImages('Before ![[photo.png]] after');
    expect(images).toHaveLength(1);
    expect(images[0].imageName).toBe('photo.png');
    expect(images[0].originalSyntax).toBe('![[photo.png]]');
    expect(content).toBe('Before __OUTLINE_IMG_0__ after');
  });

  it('detects markdown-style image embed', () => {
    const { content, images } = detectImages('Before ![alt text](path/to/image.jpg) after');
    expect(images).toHaveLength(1);
    expect(images[0].imageName).toBe('path/to/image.jpg');
    expect(content).toBe('Before __OUTLINE_IMG_0__ after');
  });

  it('handles wiki image with pipe size syntax', () => {
    const { content, images } = detectImages('![[photo.png|300]]');
    expect(images).toHaveLength(1);
    expect(images[0].imageName).toBe('photo.png');
    expect(content).toBe('__OUTLINE_IMG_0__');
  });

  it('detects multiple images', () => {
    const input = '![[one.png]] middle ![[two.jpg]]';
    const { content, images } = detectImages(input);
    expect(images).toHaveLength(2);
    expect(images[0].imageName).toBe('one.png');
    expect(images[0].placeholder).toBe('__OUTLINE_IMG_0__');
    expect(images[1].imageName).toBe('two.jpg');
    expect(images[1].placeholder).toBe('__OUTLINE_IMG_1__');
    expect(content).toBe('__OUTLINE_IMG_0__ middle __OUTLINE_IMG_1__');
  });

  it('detects mixed wiki and markdown style images', () => {
    const input = '![[wiki.png]] and ![md](markdown.gif)';
    const { images } = detectImages(input);
    expect(images).toHaveLength(2);
    expect(images[0].imageName).toBe('wiki.png');
    expect(images[1].imageName).toBe('markdown.gif');
  });

  it('supports all common image extensions', () => {
    const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    for (const ext of extensions) {
      const { images } = detectImages(`![[image.${ext}]]`);
      expect(images).toHaveLength(1);
    }
  });

  it('ignores non-image wiki embeds', () => {
    const { content, images } = detectImages('![[document.pdf]]');
    expect(images).toHaveLength(0);
    expect(content).toBe('![[document.pdf]]');
  });

  it('ignores regular wiki links (not embeds)', () => {
    const { content, images } = detectImages('[[photo.png]]');
    expect(images).toHaveLength(0);
    expect(content).toBe('[[photo.png]]');
  });

  it('handles content with no images', () => {
    const input = 'Just regular text\nWith no images';
    const { content, images } = detectImages(input);
    expect(images).toHaveLength(0);
    expect(content).toBe(input);
  });

  it('handles URL-encoded image paths', () => {
    const { images } = detectImages('![alt](path%20with%20spaces/img.png)');
    expect(images).toHaveLength(1);
    expect(images[0].imageName).toBe('path%20with%20spaces/img.png');
  });
});

describe('ImageDetector transformer', () => {
  it('writes detected images to ctx.meta.plugins.ImageDetector', () => {
    const ctx = createContext('Hello ![[photo.png]] world');
    const result = runPipeline(ctx, [ImageDetector()]);

    const pluginData = result.meta.plugins['ImageDetector'];
    expect(pluginData).toBeDefined();

    const images = pluginData['images'] as ImageRef[];
    expect(images).toHaveLength(1);
    expect(images[0].imageName).toBe('photo.png');
    expect(result.content).toBe('Hello __OUTLINE_IMG_0__ world');
  });

  it('stores empty array when no images found', () => {
    const ctx = createContext('No images here');
    const result = runPipeline(ctx, [ImageDetector()]);

    const images = result.meta.plugins['ImageDetector']?.['images'] as ImageRef[];
    expect(images).toHaveLength(0);
  });
});
