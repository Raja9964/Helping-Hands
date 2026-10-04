import { CATEGORY_KEYS, STATUSES, STATUS_FLOW, previousStatus } from '../domain.js';
import { generateDonationCode } from '../lib/donation-code.js';
import { HttpError } from '../lib/http-error.js';
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

export async function advanceStatus(code, status) {
  const from = previousStatus(status);
  if (!from) throw new HttpError(400, `"${status}" is not a status a donation can move to`);

  // Conditional on the current status, so two admins clicking at once can't skip a step.
  const updated = await Donation.findOneAndUpdate(
    { code, status: from },
    { $set: { status }, $push: { timeline: { status, at: new Date() } } },
    { returnDocument: 'after', runValidators: true, lean: true },
  );
  if (updated) return updated;

  const current = await Donation.findOne({ code }, { status: 1 }).lean();
  if (!current) throw new HttpError(404, 'Donation not found');
  throw new HttpError(
    409,
    `This donation is "${STATUSES[current.status]}" and can't move to "${STATUSES[status]}"`,
  );
}

export async function listDonations({ status, category, q, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ code: pattern }, { name: pattern }];
  }

  const [items, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Donation.countDocuments(filter),
  ]);

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getStats() {
  const [facets] = await Donation.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
      },
    },
  ]);

  const byStatus = countsFor(STATUS_FLOW, facets.byStatus);
  const byCategory = countsFor(CATEGORY_KEYS, facets.byCategory);
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  return { total, byStatus, byCategory };
}

function countsFor(keys, groups) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const { _id, count } of groups) {
    if (_id in counts) counts[_id] = count;
  }
  return counts;
}

function isDuplicateCodeError(err) {
  return err?.code === 11000 && Object.hasOwn(err.keyPattern ?? {}, 'code');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
