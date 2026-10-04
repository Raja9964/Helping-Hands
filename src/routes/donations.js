import { Router } from 'express';
import { normalizeDonationCode } from '../lib/donation-code.js';
import { HttpError } from '../lib/http-error.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { firstNameOf, toAdminView, toPublicView } from '../services/donation-views.js';
import { createDonation, findDonationByCode } from '../services/donations.js';
import { createDonationSchema } from '../validation.js';

export function donationsRouter({ config, events }) {
  const router = Router();

  const createLimit = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimits.createDonation,
    message: 'Too many donations from this network. Please try again in a few minutes.',
  });
  const trackLimit = rateLimiter({
    windowMs: 60 * 1000,
    limit: config.rateLimits.trackDonation,
    message: 'Too many lookups. Please wait a minute and try again.',
  });

  router.post('/', createLimit, validateBody(createDonationSchema), async (req, res) => {
    const donation = await createDonation(req.body);
    events.publish('donation.created', toAdminView(donation));

    res
      .status(201)
      .location(`/api/donations/${donation.code}`)
      .json({ code: donation.code, firstName: firstNameOf(donation.name) });
  });

  router.get('/:code', trackLimit, async (req, res) => {
    const code = normalizeDonationCode(req.params.code);
    if (!code) throw new HttpError(400, 'Donation codes look like GT-7K3P9Q');

    const donation = await findDonationByCode(code);
    if (!donation) throw new HttpError(404, 'We could not find a donation with that code');

    res.set('Cache-Control', 'no-store').json(toPublicView(donation));
  });

  return router;
}
