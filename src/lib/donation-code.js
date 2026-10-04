import { randomInt } from 'node:crypto';

// Crockford-style alphabet: no 0/O, 1/I/L or U, so codes are easy to read out over the phone.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_PREFIX = 'GT-';
const BODY_LENGTH = 6;
const BODY_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${BODY_LENGTH}}$`);

export function generateDonationCode(random = randomInt) {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + body;
}

// Accepts what people actually type: "gt-7k3p9q", "GT7K3P9Q" or just "7K3P9Q".
export function normalizeDonationCode(input) {
  if (typeof input !== 'string') return null;
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = compact.length === BODY_LENGTH + 2 && compact.startsWith('GT') ? compact.slice(2) : compact;
  return BODY_PATTERN.test(body) ? CODE_PREFIX + body : null;
}
