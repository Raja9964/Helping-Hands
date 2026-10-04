import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateDonationCode, normalizeDonationCode } from '../src/lib/donation-code.js';

describe('donation codes', () => {
  it('generates HH- followed by six unambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateDonationCode()).toMatch(/^HH-[2-9A-HJKMNP-TV-Z]{6}$/);
    }
  });

  it('leaves out characters that are easy to misread', () => {
    for (const char of '01ILOU') expect(CODE_ALPHABET).not.toContain(char);
  });

  it('uses the injected random source', () => {
    expect(generateDonationCode(() => 0)).toBe('HH-222222');
  });

  it.each(['HH-7K3P9Q', 'hh-7k3p9q', ' HH7K3P9Q ', '7k3p9q', 'hh 7k3 p9q'])('normalizes %j', (input) => {
    expect(normalizeDonationCode(input)).toBe('HH-7K3P9Q');
  });

  it.each(['', 'HH-7K3P9', 'HH-7K3P9QQ', 'HH-0K3P9Q', 'HH-OK3P9Q', 'XX-7K3P9Q', 42, null])('rejects %j', (input) => {
    expect(normalizeDonationCode(input)).toBeNull();
  });
});
