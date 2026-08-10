import { describe, expect, it } from 'vitest';
import { LANGUAGES, languageExtension, detectLanguage } from './languages.js';

describe('LANGUAGES / languageExtension', () => {
  it('every declared language resolves to a real (non-throwing) extension', () => {
    for (const lang of LANGUAGES) {
      expect(() => languageExtension(lang.value)).not.toThrow();
    }
  });

  it('plaintext resolves to an empty extension list', () => {
    expect(languageExtension('plaintext')).toEqual([]);
  });

  it('falls back to plaintext for an unknown value', () => {
    expect(languageExtension('not-a-real-language')).toEqual([]);
  });

  it('has no duplicate values in the language list', () => {
    const values = LANGUAGES.map((l) => l.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('detectLanguage', () => {
  it('returns plaintext for empty/blank text', () => {
    expect(detectLanguage('')).toBe('plaintext');
    expect(detectLanguage('   ')).toBe('plaintext');
  });

  it('detects valid JSON starting with { or [', () => {
    expect(detectLanguage('{"a":1}')).toBe('json');
    expect(detectLanguage('[1,2,3]')).toBe('json');
  });

  it('does not false-positive on JS-object-literal-looking invalid JSON', () => {
    expect(detectLanguage('{a: 1}')).toBe('plaintext');
  });

  it('detects HTML via a <html> tag or DOCTYPE', () => {
    expect(detectLanguage('<html><body></body></html>')).toBe('html');
    expect(detectLanguage('<!DOCTYPE html><html></html>')).toBe('html');
  });

  it('detects generic tag-soup starting with < as xml, not html', () => {
    expect(detectLanguage('<root><child/></root>')).toBe('xml');
  });

  it('defaults everything else to plaintext', () => {
    expect(detectLanguage('just some plain text')).toBe('plaintext');
    expect(detectLanguage('def foo():\n  pass')).toBe('plaintext');
  });
});
