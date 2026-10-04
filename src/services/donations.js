import { STATUS_FLOW } from '../domain.js';
import { generateDonationCode } from '../lib/donation-code.js';
import { Donation } from '../models/donation.js';

const MAX_CODE_ATTEMPTS = 5;

export async function createDonation(input, { generateCode = generateDonationCode } = {}) {
  for (let attempt = 1; ; attempt++) {
    const status = STATUS_FLOW[0];
    try {
      const donation = await Donation.create({
        ...input,
        code: generateCode(),
        status,
        timeline: [{ status, at: new Date() }],
      });
      return donation.toObject();
    } catch (err) {
      // ~730M possible codes, so a clash is rare; the unique index catches it and we just roll again.
      if (!isDuplicateCodeError(err) || attempt >= MAX_CODE_ATTEMPTS) throw err;
    }
  }
}

export function findDonationByCode(code) {
  return Donation.findOne({ code }).lean();
}

function isDuplicateCodeError(err) {
  return err?.code === 11000 && Object.hasOwn(err.keyPattern ?? {}, 'code');
}
