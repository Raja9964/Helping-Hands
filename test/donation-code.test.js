import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateDonationCode, normalizeDonationCode } from '../src/lib/donation-code.js';

describe('donation codes', () => {
  it('generates GT- followed by six unambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateDonationCode()).toMatch(/^GT-[2-9A-HJKMNP-TV-Z]{6}$/);
    }
  });

  it('leaves out characters that are easy to misread', () => {
    for (const char of '01ILOU') expect(CODE_ALPHABET).not.toContain(char);
  });

  it('uses the injected random source', () => {
    expect(generateDonationCode(() => 0)).toBe('GT-222222');
  });

  it.each(['GT-7K3P9Q', 'gt-7k3p9q', ' GT7K3P9Q ', '7k3p9q', 'gt 7k3 p9q'])('normalizes %j', (input) => {
    expect(normalizeDonationCode(input)).toBe('GT-7K3P9Q');
  });

  it.each(['', 'GT-7K3P9', 'GT-7K3P9QQ', 'GT-0K3P9Q', 'GT-OK3P9Q', 'XX-7K3P9Q', 42, null])('rejects %j', (input) => {
    expect(normalizeDonationCode(input)).toBeNull();
  });
});
