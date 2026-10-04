import { rateLimit } from 'express-rate-limit';

export function rateLimiter({ windowMs, limit, message, ...options }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message },
    ...options,
  });
}
