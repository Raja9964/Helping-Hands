import { Router } from 'express';
import { normalizeDonationCode } from '../lib/donation-code.js';
import { HttpError } from '../lib/http-error.js';
import {
  endSession,
  hasValidSession,
  passwordMatches,
  requireAdmin,
  startSession,
} from '../middleware/admin-session.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { parseOrThrow, validateBody } from '../middleware/validate.js';
import { toAdminView } from '../services/donation-views.js';
import { advanceStatus, getStats, listDonations } from '../services/donations.js';
import { listQuerySchema, loginSchema, statusUpdateSchema } from '../validation.js';
import { liveEvents } from './live-events.js';

export function adminRouter({ config, events }) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const cookieOptions = { secure: config.isProduction };

  const loginLimit = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimits.login,
    skipSuccessfulRequests: true,
    message: 'Too many failed logins. Please try again in 15 minutes.',
  });

  router.post('/login', loginLimit, validateBody(loginSchema), (req, res) => {
    if (!passwordMatches(req.body.password, config.adminPassword)) {
      throw new HttpError(401, 'Incorrect password');
    }
    startSession(res, cookieOptions);
    res.status(204).end();
  });

  router.post('/logout', (req, res) => {
    endSession(res, cookieOptions);
    res.status(204).end();
  });

  router.get('/session', (req, res) => {
    res.json({ authenticated: hasValidSession(req) });
  });

  router.use(requireAdmin);

  router.get('/donations', async (req, res) => {
    const query = parseOrThrow(listQuerySchema, req.query);
    const result = await listDonations(query);
    res.json({ ...result, items: result.items.map(toAdminView) });
  });

  router.patch('/donations/:code/status', validateBody(statusUpdateSchema), async (req, res) => {
    const code = normalizeDonationCode(req.params.code);
    if (!code) throw new HttpError(404, 'Donation not found');

    const donation = toAdminView(await advanceStatus(code, req.body.status));
    events.publish('donation.updated', donation);
    res.json(donation);
  });

  router.get('/stats', async (req, res) => {
    res.json(await getStats());
  });

  router.get('/events', liveEvents(events));

  return router;
}
