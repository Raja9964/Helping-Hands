import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Donation } from '../src/models/donation.js';
import { createDonation } from '../src/services/donations.js';
import { createDonationViaApi, donationInput, testApp, useTestDatabase } from './helpers.js';

useTestDatabase();
const app = testApp();

describe('POST /api/donations', () => {
  it('stores a cleaned-up donation and returns its code', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send(donationInput({ name: '  Priya Sharma  ' }))
      .expect(201);

    expect(res.body).toEqual({ code: expect.stringMatching(/^GT-[A-Z2-9]{6}$/), firstName: 'Priya' });
    expect(res.headers.location).toBe(`/api/donations/${res.body.code}`);

    const saved = await Donation.findOne({ code: res.body.code }).lean();
    expect(saved).toMatchObject({ name: 'Priya Sharma', phone: '+919845012345', status: 'received' });
    expect(saved.timeline).toHaveLength(1);
  });

  it.each(['9845012345', '+91 98450 12345', '09845012345', '91-98450-12345', '919845012345'])(
    'accepts the Indian mobile format %j',
    async (phone) => {
      const code = await createDonationViaApi(app, { phone });
      expect((await Donation.findOne({ code })).phone).toBe('+919845012345');
    },
  );

  it.each(['12345', '5845012345', '98450123456', '+1 9845012345', 'call me'])(
    'rejects the phone number %j',
    async (phone) => {
      const res = await request(app).post('/api/donations').send(donationInput({ phone })).expect(400);
      expect(res.body.details).toEqual([{ field: 'phone', message: 'Enter a valid 10-digit Indian mobile number' }]);
    },
  );

  it('reports every missing field', async () => {
    const res = await request(app).post('/api/donations').send({}).expect(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['name', 'phone', 'category', 'address']);
  });

  it.each([
    ['name', 42],
    ['name', 'x'.repeat(81)],
    ['address', 'short'],
    ['address', 'x'.repeat(301)],
    ['notes', 'x'.repeat(501)],
    ['notes', { $gt: '' }],
    ['category', 'cash'],
  ])('rejects an invalid %s', async (field, value) => {
    const res = await request(app).post('/api/donations').send(donationInput({ [field]: value })).expect(400);
    expect(res.body.details.map((d) => d.field)).toContain(field);
  });

  it('ignores fields the client should not control', async () => {
    const code = await createDonationViaApi(app, { status: 'delivered', code: 'GT-222222', timeline: [] });
    const saved = await Donation.findOne({ code }).lean();
    expect(code).not.toBe('GT-222222');
    expect(saved.status).toBe('received');
    expect(saved.timeline).toHaveLength(1);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/donations')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.error).toBe('Request body must be valid JSON');
  });

  it('rate limits repeated submissions', async () => {
    const limited = testApp({ rateLimits: { createDonation: 2 } });
    await createDonationViaApi(limited);
    await createDonationViaApi(limited);
    const res = await request(limited).post('/api/donations').send(donationInput()).expect(429);
    expect(res.body.error).toMatch(/Too many donations/);
  });
});

describe('createDonation', () => {
  it('rolls a new code when the first one is already taken', async () => {
    await createDonation(donationInput(), { generateCode: () => 'GT-AAAAAA' });
    const codes = ['GT-AAAAAA', 'GT-BBBBBB'];

    const donation = await createDonation(donationInput(), { generateCode: () => codes.shift() });

    expect(donation.code).toBe('GT-BBBBBB');
  });
});
