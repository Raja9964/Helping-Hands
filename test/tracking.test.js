import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDonationViaApi, testApp, useTestDatabase } from './helpers.js';

useTestDatabase();
const app = testApp();

describe('GET /api/donations/:code', () => {
  it('returns the public status timeline', async () => {
    const code = await createDonationViaApi(app);
    const res = await request(app).get(`/api/donations/${code}`).expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ code, firstName: 'Priya', category: 'clothes', status: 'received' });
    expect(res.body.timeline.map((step) => [step.status, step.label, step.at !== null])).toEqual([
      ['received', 'Received', true],
      ['scheduled', 'Scheduled for pickup', false],
      ['collected', 'Collected', false],
      ['delivered', 'Delivered', false],
    ]);
  });

  it('never exposes personal details', async () => {
    const code = await createDonationViaApi(app);
    const res = await request(app).get(`/api/donations/${code}`).expect(200);

    expect(Object.keys(res.body).sort()).toEqual(
      ['category', 'categoryLabel', 'code', 'createdAt', 'firstName', 'status', 'statusLabel', 'timeline'].sort(),
    );
    const raw = JSON.stringify(res.body);
    for (const secret of ['9845012345', 'Sharma', 'Indiranagar', 'winter wear', '_id']) {
      expect(raw).not.toContain(secret);
    }
  });

  it('accepts codes typed in lowercase without the dash', async () => {
    const code = await createDonationViaApi(app);
    const typed = code.replace('-', '').toLowerCase();
    await request(app).get(`/api/donations/${typed}`).expect(200);
  });

  it('returns 404 for an unknown code and 400 for a malformed one', async () => {
    await request(app).get('/api/donations/GT-ZZZZZZ').expect(404);
    const res = await request(app).get('/api/donations/hello').expect(400);
    expect(res.body.error).toMatch(/GT-/);
  });
});
