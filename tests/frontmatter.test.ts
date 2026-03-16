import {
  parseFrontmatter,
  stripFrontmatter,
  getOutlineMeta,
  FrontmatterTransformer,
  createContext,
  runPipeline,
} from '../src/pipeline';

describe('parseFrontmatter', () => {
  it('parses key-value pairs from YAML frontmatter', () => {
    const input = '---\ntitle: Hello World\nauthor: Jane\n---\nBody text';
    const { meta, body } = parseFrontmatter(input);
    expect(meta['title']).toBe('Hello World');
    expect(meta['author']).toBe('Jane');
    expect(body).toBe('Body text');
  });

  it('parses boolean values', () => {
    const input = '---\npublished: true\ndraft: false\n---\nContent';
    const { meta } = parseFrontmatter(input);
    expect(meta['published']).toBe(true);
    expect(meta['draft']).toBe(false);
  });

  it('parses numeric values', () => {
    const input = '---\norder: 42\nweight: 3.14\n---\nContent';
    const { meta } = parseFrontmatter(input);
    expect(meta['order']).toBe(42);
    expect(meta['weight']).toBe(3.14);
  });

  it('strips quotes from string values', () => {
    const input = '---\ntitle: "Quoted Title"\nother: \'Single\'\n---\nContent';
    const { meta } = parseFrontmatter(input);
    expect(meta['title']).toBe('Quoted Title');
    expect(meta['other']).toBe('Single');
  });

  it('returns empty meta and original body when no frontmatter', () => {
    const input = 'Just some plain text\nWith multiple lines';
    const { meta, body } = parseFrontmatter(input);
    expect(meta).toEqual({});
    expect(body).toBe(input);
  });

  it('handles values containing colons', () => {
    const input = '---\nurl: https://example.com\n---\nBody';
    const { meta } = parseFrontmatter(input);
    expect(meta['url']).toBe('https://example.com');
  });

  it('handles empty frontmatter block', () => {
    const input = '---\n\n---\nBody text';
    const { meta, body } = parseFrontmatter(input);
    expect(meta).toEqual({});
    expect(body).toBe('Body text');
  });
});

describe('stripFrontmatter', () => {
  it('removes frontmatter block and returns body only', () => {
    const input = '---\ntitle: Test\n---\nBody content here';
    expect(stripFrontmatter(input)).toBe('Body content here');
  });

  it('returns content unchanged when no frontmatter', () => {
    const input = 'No frontmatter here\nJust text';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('handles Windows line endings', () => {
    const input = '---\r\ntitle: Test\r\n---\r\nBody content';
    expect(stripFrontmatter(input)).toBe('Body content');
  });
});

describe('getOutlineMeta', () => {
  it('extracts outline-specific fields', () => {
    const input =
      '---\noutline_id: abc-123\noutline_collection_id: col-456\noutline_last_synced: 2026-01-01T00:00:00Z\n---\nBody';
    const meta = getOutlineMeta(input);
    expect(meta.outline_id).toBe('abc-123');
    expect(meta.outline_collection_id).toBe('col-456');
    expect(meta.outline_last_synced).toBe('2026-01-01T00:00:00Z');
  });

  it('returns undefined for missing outline fields', () => {
    const input = '---\ntitle: Normal note\n---\nBody';
    const meta = getOutlineMeta(input);
    expect(meta.outline_id).toBeUndefined();
    expect(meta.outline_collection_id).toBeUndefined();
    expect(meta.outline_last_synced).toBeUndefined();
  });

  it('returns undefined for content without frontmatter', () => {
    const meta = getOutlineMeta('Just plain text');
    expect(meta.outline_id).toBeUndefined();
  });
});

describe('FrontmatterTransformer', () => {
  it('strips frontmatter and populates ctx.meta.frontmatter', () => {
    const ctx = createContext('---\ntitle: Hello\ntags: test\n---\nBody text');
    const result = runPipeline(ctx, [FrontmatterTransformer()]);

    expect(result.content).toBe('Body text');
    expect(result.meta.frontmatter['title']).toBe('Hello');
    expect(result.meta.frontmatter['tags']).toBe('test');
  });

  it('records hadFrontmatter in plugin metadata', () => {
    const withFm = createContext('---\ntitle: A\n---\nBody');
    const r1 = runPipeline(withFm, [FrontmatterTransformer()]);
    expect(r1.meta.plugins['FrontmatterTransformer']?.['hadFrontmatter']).toBe(true);

    const noFm = createContext('No frontmatter here');
    const r2 = runPipeline(noFm, [FrontmatterTransformer()]);
    expect(r2.meta.plugins['FrontmatterTransformer']?.['hadFrontmatter']).toBe(false);
  });

  it('leaves content unchanged when no frontmatter', () => {
    const ctx = createContext('Regular content\nNo front matter');
    const result = runPipeline(ctx, [FrontmatterTransformer()]);
    expect(result.content).toBe('Regular content\nNo front matter');
    expect(result.meta.frontmatter).toEqual({});
  });
});
