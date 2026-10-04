import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: z.string().trim().min(1).default('mongodb://127.0.0.1:27017/givetrack'),
  ADMIN_PASSWORD: z
    .string({ error: 'is required' })
    .min(8, 'must be at least 8 characters'),
  SESSION_SECRET: z
    .string({ error: 'is required' })
    .min(32, 'must be at least 32 characters'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export const defaultRateLimits = Object.freeze({
  createDonation: 10,
  trackDonation: 60,
  login: 10,
});

export function loadConfig(env = process.env) {
  // Treat `PORT=` in a .env file the same as not setting it at all.
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(defined);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')} ${issue.message}`);
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }

  const vars = result.data;
  return Object.freeze({
    env: vars.NODE_ENV,
    isProduction: vars.NODE_ENV === 'production',
    port: vars.PORT,
    mongodbUri: vars.MONGODB_URI,
    adminPassword: vars.ADMIN_PASSWORD,
    sessionSecret: vars.SESSION_SECRET,
    trustProxy: vars.TRUST_PROXY,
    rateLimits: defaultRateLimits,
  });
}
