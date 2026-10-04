import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';

const COOKIE_NAME = 'hh_admin';
const COOKIE_PATH = '/api/admin';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Hashing first gives equal-length buffers, so the comparison is constant-time
// and doesn't leak the password length.
export function passwordMatches(candidate, expected) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

// The cookie only carries an expiry timestamp; cookie-parser signs it with
// SESSION_SECRET (HMAC), so it can't be forged or extended client-side.
export function startSession(res, { secure }) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.cookie(COOKIE_NAME, String(expiresAt), {
    signed: true,
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_MS,
  });
}

export function endSession(res, { secure }) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure, path: COOKIE_PATH });
}

export function hasValidSession(req) {
  const expiresAt = Number(req.signedCookies?.[COOKIE_NAME]);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function requireAdmin(req, res, next) {
  next(hasValidSession(req) ? undefined : new HttpError(401, 'Please log in as an admin'));
}
