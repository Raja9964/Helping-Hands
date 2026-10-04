// Browser stand-in for node:crypto. Donation codes only need randomInt.
export function randomInt(max) {
  const limit = 2 ** 32 - (2 ** 32 % max);
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}
