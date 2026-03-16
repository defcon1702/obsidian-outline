import { removeToc, TocRemover } from '../src/pipeline/transformers/tocRemover';
import { createContext } from '../src/pipeline';

describe('removeToc', () => {
  it('removes a simple TOC block of section links', () => {
    const input = [
      '- [[#Introduction]]',
      '- [[#Setup]]',
      '- [[#Conclusion]]',
      '',
      '# Introduction',
      'Some text.',
    ].join('\n');

    const expected = ['', '# Introduction', 'Some text.'].join('\n');

    expect(removeToc(input)).toBe(expected);
  });

  it('removes an indented/nested TOC block', () => {
    const input = [
      '- [[#1 Einleitung und Basics]]',
      '- [[#2 Berechtigungen]]',
      '- [[#3 Aufbau der Startseite]]',
      '    - [[#3.1 Vertragsakte anlegen]]',
      '    - [[#3.2 Aufbau Eingabemaske]]',
      '    - [[#3.3 Meine Filter]]',
      '- [[#4 Weitere Funktionen]]',
      '    - [[#4.1 Vertrag senden]]',
      '',
      '# **1 Einleitung und Basics**',
    ].join('\n');

    const expected = ['', '# **1 Einleitung und Basics**'].join('\n');

    expect(removeToc(input)).toBe(expected);
  });

  it('preserves content that is not a TOC', () => {
    const input = [
      '# Title',
      '',
      'Some paragraph text.',
      '',
      '- regular list item',
      '- another item',
    ].join('\n');

    expect(removeToc(input)).toBe(input);
  });

  it('preserves list items with non-section wiki links', () => {
    const input = ['- See [[Other Page]]', '- Also [[Another Page|alias]]'].join('\n');

    expect(removeToc(input)).toBe(input);
  });

  it('removes TOC appearing after a heading', () => {
    const input = [
      '# Title',
      '',
      '- [[#Section A]]',
      '- [[#Section B]]',
      '',
      '## Section A',
      'Content here.',
    ].join('\n');

    const expected = ['# Title', '', '', '## Section A', 'Content here.'].join('\n');

    expect(removeToc(expected)).toBe(expected);
    expect(removeToc(input)).toBe(expected);
  });

  it('handles TOC with asterisk list markers', () => {
    const input = ['* [[#First]]', '* [[#Second]]', '', '# First'].join('\n');

    const expected = ['', '# First'].join('\n');

    expect(removeToc(input)).toBe(expected);
  });

  it('handles numbered TOC items', () => {
    const input = [
      '1. [[#Chapter 1]]',
      '2. [[#Chapter 2]]',
      '3. [[#Chapter 3]]',
      '',
      '# Chapter 1',
    ].join('\n');

    const expected = ['', '# Chapter 1'].join('\n');

    expect(removeToc(input)).toBe(expected);
  });

  it('does not remove mixed list items (some with section links, some without)', () => {
    const input = ['- [[#Intro]]', '- Just a regular item', '- [[#Outro]]'].join('\n');

    // The first line is a TOC line, second is not, so the block stops at line 1.
    // Line 2 and 3 stay (line 3 starts a new block but line 2 breaks the run).
    const result = removeToc(input);
    expect(result).toContain('Just a regular item');
  });

  it('returns empty content unchanged', () => {
    expect(removeToc('')).toBe('');
  });

  it('handles content with no TOC', () => {
    const input = '# Heading\n\nParagraph text.';
    expect(removeToc(input)).toBe(input);
  });

  it('handles real-world Contract-Management TOC', () => {
    const input = [
      '- [[#1 Einleitung und Basics]]',
      '- [[#2 Kein Zugriff? Berechtigungen im Contract Management]]',
      '- [[#3 Aufbau der Startseite]]',
      '    - [[#3.1 Vertragsakte anlegen]]',
      '    - [[#3.2 Aufbau Eingabemaske]]',
      '    - [[#3.3 Meine Filter]]',
      '- [[#4 Weitere Funktionen in der Vertragsmaske]]',
      '    - [[#4.1 Vertrag senden]]',
      '    - [[#4.2 Quick Edit:]]',
      '    - [[#4.3 Workflows und Benachrichtigungen]]',
      '- [[#5 Vertragsakten suchen]]',
      '- [[#6 Beispiele: Anlegen einer Vertragsmaske]]',
      '',
      '# **1 Einleitung und Basics**',
      '',
      'Some content here.',
    ].join('\n');

    const result = removeToc(input);
    expect(result).not.toContain('[[#1 Einleitung und Basics]]');
    expect(result).not.toContain('[[#3.1 Vertragsakte anlegen]]');
    expect(result).toContain('# **1 Einleitung und Basics**');
    expect(result).toContain('Some content here.');
  });
});

describe('TocRemover transformer', () => {
  it('removes TOC from context content', () => {
    const ctx = createContext('- [[#Intro]]\n- [[#End]]\n\n# Intro\nText.', 'test', 'test.md');
    const result = TocRemover().transform(ctx);
    expect(result.content).not.toContain('[[#Intro]]');
    expect(result.content).toContain('# Intro');
    expect(result.content).toContain('Text.');
  });

  it('preserves meta through transform', () => {
    const ctx = createContext('- [[#A]]\n\n# A', 'file', 'file.md');
    ctx.meta.frontmatter = { key: 'value' };
    const result = TocRemover().transform(ctx);
    expect(result.meta.frontmatter).toEqual({ key: 'value' });
    expect(result.meta.fileName).toBe('file');
  });
});
