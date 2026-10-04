// The same routes as src/routes, answered from browser storage instead of
// Express and MongoDB. Validation, codes and response views are the real ones.
import { CATEGORY_KEYS, STATUSES, STATUS_FLOW, previousStatus } from '../src/domain.js';
import { generateDonationCode, normalizeDonationCode } from '../src/lib/donation-code.js';
import { HttpError } from '../src/lib/http-error.js';
import { parseOrThrow } from '../src/middleware/validate.js';
import { firstNameOf, toAdminView, toPublicView } from '../src/services/donation-views.js';
import { createDonationSchema, listQuerySchema, loginSchema, statusUpdateSchema } from '../src/validation.js';
import { DEMO_ADMIN_PASSWORD, demoDonations } from '../scripts/demo-data.js';

const DATA_KEY = 'helping-hands-demo:donations';
const SESSION_KEY = 'helping-hands-demo:admin-session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function createDemoApi({ storage, publish = () => {}, now = Date.now }) {
  const routes = [
    ['POST', /^donations$/, createDonation],
    ['GET', /^donations\/([^/]+)$/, trackDonation],
    ['POST', /^admin\/login$/, login],
    ['POST', /^admin\/logout$/, logout],
    ['GET', /^admin\/session$/, () => reply(200, { authenticated: isAdmin() })],
    ['GET', /^admin\/donations$/, adminOnly(listDonations)],
    ['PATCH', /^admin\/donations\/([^/]+)\/status$/, adminOnly(advanceStatus)],
    ['GET', /^admin\/stats$/, adminOnly(getStats)],
  ];

  function request(method, path, { body, query = {} } = {}) {
    try {
      for (const [verb, pattern, handler] of routes) {
        const match = pattern.exec(path);
        if (match && verb === method) {
          return handler({ body: body ?? {}, query, params: match.slice(1).map(decode) });
        }
      }
      throw new HttpError(404, 'Not found');
    } catch (err) {
      if (err instanceof HttpError) return reply(err.status, { error: err.message, details: err.details });
      console.error('Demo API error:', err);
      return reply(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  function createDonation({ body }) {
    const input = parseOrThrow(createDonationSchema, body);
    const donations = load();

    let code;
    do {
      code = generateDonationCode();
    } while (donations.some((donation) => donation.code === code));

    const at = timestamp();
    const status = STATUS_FLOW[0];
    const donation = { ...input, code, status, timeline: [{ status, at }], createdAt: at, updatedAt: at };
    save([...donations, donation]);
    publish('donation.created', toAdminView(donation));

    return reply(201, { code, firstName: firstNameOf(donation.name) });
  }

  function trackDonation({ params: [raw] }) {
    const code = normalizeDonationCode(raw);
    if (!code) throw new HttpError(400, 'Donation codes look like HH-7K3P9Q');

    const donation = load().find((item) => item.code === code);
    if (!donation) throw new HttpError(404, 'We could not find a donation with that code');

    return reply(200, toPublicView(donation));
  }

  function login({ body }) {
    const { password } = parseOrThrow(loginSchema, body);
    if (password !== DEMO_ADMIN_PASSWORD) throw new HttpError(401, 'Incorrect password');

    storage.setItem(SESSION_KEY, String(now() + SESSION_TTL_MS));
    return reply(204);
  }

  function logout() {
    storage.removeItem(SESSION_KEY);
    return reply(204);
  }

  function isAdmin() {
    return Number(storage.getItem(SESSION_KEY)) > now();
  }

  function adminOnly(handler) {
    return (req) => {
      if (!isAdmin()) throw new HttpError(401, 'Please log in as an admin');
      return handler(req);
    };
  }

  function listDonations({ query }) {
    const { status, category, q, page, limit } = parseOrThrow(listQuerySchema, query);
    const search = q?.toLowerCase();

    const matches = load()
      .filter((donation) => !status || donation.status === status)
      .filter((donation) => !category || donation.category === category)
      .filter((donation) => !search || [donation.code, donation.name].some((field) => field.toLowerCase().includes(search)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return reply(200, {
      items: matches.slice((page - 1) * limit, page * limit).map(toAdminView),
      total: matches.length,
      page,
      pages: Math.max(1, Math.ceil(matches.length / limit)),
    });
  }

  // Same rule as the server: only the next step, and only from the step before it.
  function advanceStatus({ params: [raw], body }) {
    const { status } = parseOrThrow(statusUpdateSchema, body);
    const code = normalizeDonationCode(raw);
    const donations = load();

    const donation = donations.find((item) => item.code === code);
    if (!donation) throw new HttpError(404, 'Donation not found');
    if (donation.status !== previousStatus(status)) {
      throw new HttpError(409, `This donation is "${STATUSES[donation.status]}" and can't move to "${STATUSES[status]}"`);
    }

    const at = timestamp();
    donation.status = status;
    donation.timeline.push({ status, at });
    donation.updatedAt = at;
    save(donations);

    const view = toAdminView(donation);
    publish('donation.updated', view);
    return reply(200, view);
  }

  function getStats() {
    const donations = load();
    return reply(200, {
      total: donations.length,
      byStatus: countBy(donations, 'status', STATUS_FLOW),
      byCategory: countBy(donations, 'category', CATEGORY_KEYS),
    });
  }

  function reset() {
    storage.removeItem(DATA_KEY);
    load();
    // Open dashboards reload their data on any donation event.
    publish('donation.updated', {});
  }

  function load() {
    const saved = readJson(storage.getItem(DATA_KEY));
    if (Array.isArray(saved)) return saved;

    const seeded = JSON.parse(JSON.stringify(demoDonations(now())));
    save(seeded);
    return seeded;
  }

  function save(donations) {
    storage.setItem(DATA_KEY, JSON.stringify(donations));
  }

  function timestamp() {
    return new Date(now()).toISOString();
  }

  return { request, isAdmin, reset };
}

function reply(status, body) {
  return { status, body };
}

function countBy(items, field, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const item of items) {
    if (item[field] in counts) counts[item[field]] += 1;
  }
  return counts;
}

function decode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
