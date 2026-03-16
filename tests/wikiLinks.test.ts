import {
  replaceWikiLinks,
  resolveWikiLinkMarkers,
  WikiLinkTransformer,
  createContext,
  runPipeline,
} from '../src/pipeline';

const knownDocs: Record<string, string> = {
  'My Page': 'uuid-my-page',
  'Another Note': 'uuid-another',
  'Project Plan': 'uuid-project',
};

const resolver = (target: string) => knownDocs[target] ?? null;

const outlineUrl = 'https://outline.example.com';

describe('replaceWikiLinks', () => {
  it('resolves a simple wiki link', () => {
    const output = replaceWikiLinks('See [[My Page]] for details', resolver, outlineUrl);
    expect(output).toBe('See [My Page](https://outline.example.com/doc/uuid-my-page) for details');
  });

  it('uses alias as display text', () => {
    const output = replaceWikiLinks('Check [[My Page|the page]]', resolver, outlineUrl);
    expect(output).toBe('Check [the page](https://outline.example.com/doc/uuid-my-page)');
  });

  it('strips heading fragment from link target', () => {
    const output = replaceWikiLinks('See [[My Page#section]]', resolver, outlineUrl);
    expect(output).toBe('See [My Page](https://outline.example.com/doc/uuid-my-page)');
  });

  it('strips heading fragment and uses alias', () => {
    const output = replaceWikiLinks('See [[My Page#section|alias]]', resolver, outlineUrl);
    expect(output).toBe('See [alias](https://outline.example.com/doc/uuid-my-page)');
  });

  it('converts unresolved link to plain text', () => {
    const output = replaceWikiLinks('See [[Unknown Page]]', resolver, outlineUrl);
    expect(output).toBe('See Unknown Page');
  });

  it('handles multiple links on one line', () => {
    const output = replaceWikiLinks(
      'Compare [[My Page]] and [[Another Note]]',
      resolver,
      outlineUrl
    );
    expect(output).toBe(
      'Compare [My Page](https://outline.example.com/doc/uuid-my-page) and [Another Note](https://outline.example.com/doc/uuid-another)'
    );
  });

  it('handles a mix of resolved and unresolved links', () => {
    const output = replaceWikiLinks(
      '[[My Page]] and [[Missing]] and [[Project Plan]]',
      resolver,
      outlineUrl
    );
    expect(output).toBe(
      '[My Page](https://outline.example.com/doc/uuid-my-page) and Missing and [Project Plan](https://outline.example.com/doc/uuid-project)'
    );
  });

  it('leaves non-wiki-link content unchanged', () => {
    const input = 'No links here, just [regular](http://example.com) markdown';
    const output = replaceWikiLinks(input, resolver, outlineUrl);
    expect(output).toBe(input);
  });

  it('handles links with no resolver (all become plain text)', () => {
    const output = replaceWikiLinks('[[My Page]]', () => null, outlineUrl);
    expect(output).toBe('My Page');
  });

  it('falls back to relative /doc/ path when outlineUrl is not provided', () => {
    const output = replaceWikiLinks('See [[My Page]]', resolver);
    expect(output).toBe('See [My Page](/doc/uuid-my-page)');
  });
});

describe('preserveUnresolved markers', () => {
  it('emits marker for unresolved link when preserveUnresolved is true', () => {
    const output = replaceWikiLinks('See [[Unknown Page]]', resolver, outlineUrl, true);
    expect(output).toBe('See %%WIKILINK[Unknown Page|Unknown Page]%%');
  });

  it('still resolves known links normally', () => {
    const output = replaceWikiLinks('See [[My Page]]', resolver, outlineUrl, true);
    expect(output).toBe('See [My Page](https://outline.example.com/doc/uuid-my-page)');
  });

  it('preserves alias in marker', () => {
    const output = replaceWikiLinks('See [[Unknown|alias]]', resolver, outlineUrl, true);
    expect(output).toBe('See %%WIKILINK[Unknown|alias]%%');
  });

  it('mixes resolved links and markers', () => {
    const output = replaceWikiLinks('[[My Page]] and [[Unknown]] end', resolver, outlineUrl, true);
    expect(output).toBe(
      '[My Page](https://outline.example.com/doc/uuid-my-page) and %%WIKILINK[Unknown|Unknown]%% end'
    );
  });
});

describe('resolveWikiLinkMarkers', () => {
  it('resolves markers using a new resolver', () => {
    const markerText = 'See %%WIKILINK[Unknown Page|Unknown Page]%% here';
    const newResolver = (t: string) => (t === 'Unknown Page' ? 'uuid-unknown' : null);
    const output = resolveWikiLinkMarkers(markerText, newResolver, outlineUrl);
    expect(output).toBe('See [Unknown Page](https://outline.example.com/doc/uuid-unknown) here');
  });

  it('falls back to plain text if still unresolvable', () => {
    const markerText = 'See %%WIKILINK[Missing|Missing]%% here';
    const output = resolveWikiLinkMarkers(markerText, () => null, outlineUrl);
    expect(output).toBe('See Missing here');
  });

  it('handles multiple markers', () => {
    const markerText = '%%WIKILINK[A|A]%% and %%WIKILINK[B|B]%%';
    const newResolver = (t: string) => {
      if (t === 'A') return 'uuid-a';
      if (t === 'B') return 'uuid-b';
      return null;
    };
    const output = resolveWikiLinkMarkers(markerText, newResolver, outlineUrl);
    expect(output).toBe(
      '[A](https://outline.example.com/doc/uuid-a) and [B](https://outline.example.com/doc/uuid-b)'
    );
  });

  it('preserves alias text from marker', () => {
    const markerText = '%%WIKILINK[Target|Custom Alias]%%';
    const output = resolveWikiLinkMarkers(
      markerText,
      (t) => (t === 'Target' ? 'uuid-target' : null),
      outlineUrl
    );
    expect(output).toBe('[Custom Alias](https://outline.example.com/doc/uuid-target)');
  });
});

describe('WikiLinkTransformer', () => {
  it('works through the pipeline with outlineUrl', () => {
    const ctx = createContext('See [[My Page]] for info');
    const result = runPipeline(ctx, [WikiLinkTransformer({ resolve: resolver, outlineUrl })]);
    expect(result.content).toBe(
      'See [My Page](https://outline.example.com/doc/uuid-my-page) for info'
    );
  });

  it('uses default resolver (no resolution) when no options provided', () => {
    const ctx = createContext('See [[My Page]] for info');
    const result = runPipeline(ctx, [WikiLinkTransformer()]);
    expect(result.content).toBe('See My Page for info');
  });
});
