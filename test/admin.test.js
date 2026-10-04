import { createHmac } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, createDonationViaApi, SESSION_SECRET, testApp, useTestDatabase } from './helpers.js';

useTestDatabase();
const app = testApp();

// Same format cookie-parser uses for signed cookies.
function signedCookie(value, secret) {
  const signature = createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '');
  return `gt_admin=${encodeURIComponent(`s:${value}.${signature}`)}`;
}

describe('admin authentication', () => {
  it('rejects a wrong password without setting a cookie', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'nope-nope' }).expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('sets a signed, httpOnly, same-site session cookie', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'correct-horse-battery' }).expect(204);
    const [cookie] = res.headers['set-cookie'];
    expect(cookie).toMatch(/^gt_admin=s%3A\d+\./);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/admin');
  });

  it.each([
    ['get', '/api/admin/donations'],
    ['get', '/api/admin/stats'],
    ['get', '/api/admin/events'],
    ['patch', '/api/admin/donations/GT-222222/status'],
  ])('protects %s %s', async (method, path) => {
    await request(app)[method](path).expect(401);
  });

  it('only trusts cookies signed with the session secret and not yet expired', async () => {
    const future = String(Date.now() + 60_000);
    const past = String(Date.now() - 1);

    await request(app).get('/api/admin/stats').set('Cookie', signedCookie(future, SESSION_SECRET)).expect(200);
    await request(app).get('/api/admin/stats').set('Cookie', signedCookie(future, 'x'.repeat(32))).expect(401);
    await request(app).get('/api/admin/stats').set('Cookie', signedCookie(past, SESSION_SECRET)).expect(401);
    await request(app).get('/api/admin/stats').set('Cookie', `gt_admin=${future}`).expect(401);
  });

  it('ends the session on logout', async () => {
    const agent = await adminAgent(app);
    expect((await agent.get('/api/admin/session')).body).toEqual({ authenticated: true });
    await agent.post('/api/admin/logout').expect(204);
    await agent.get('/api/admin/stats').expect(401);
  });

  it('rate limits failed logins', async () => {
    const limited = testApp({ rateLimits: { login: 2 } });
    for (let i = 0; i < 2; i++) {
      await request(limited).post('/api/admin/login').send({ password: 'wrong-pass' }).expect(401);
    }
    await request(limited).post('/api/admin/login').send({ password: 'wrong-pass' }).expect(429);
  });
});

describe('admin donations', () => {
  it('lists donations with contact details and filters them', async () => {
    const priya = await createDonationViaApi(app);
    await createDonationViaApi(app, { name: 'Arjun Nair', category: 'food' });
    const agent = await adminAgent(app);

    const all = await agent.get('/api/admin/donations').expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[1]).toMatchObject({ code: priya, phone: '+919845012345', nextStatus: 'scheduled' });

    const food = await agent.get('/api/admin/donations?category=food').expect(200);
    expect(food.body.items.map((d) => d.name)).toEqual(['Arjun Nair']);

    const search = await agent.get(`/api/admin/donations?q=${priya.slice(3).toLowerCase()}`).expect(200);
    expect(search.body.items.map((d) => d.code)).toEqual([priya]);

    await agent.get('/api/admin/donations?status=lost').expect(400);
  });

  it('counts donations by status and category', async () => {
    await createDonationViaApi(app);
    await createDonationViaApi(app, { category: 'food' });
    const agent = await adminAgent(app);

    const { body } = await agent.get('/api/admin/stats').expect(200);
    expect(body.total).toBe(2);
    expect(body.byStatus).toEqual({ received: 2, scheduled: 0, collected: 0, delivered: 0 });
    expect(body.byCategory).toMatchObject({ clothes: 1, food: 1, gadgets: 0 });
  });
});

describe('status updates', () => {
  it('moves a donation forward and appends to the public timeline', async () => {
    const code = await createDonationViaApi(app);
    const agent = await adminAgent(app);

    const res = await agent.patch(`/api/admin/donations/${code}/status`).send({ status: 'scheduled' }).expect(200);
    expect(res.body).toMatchObject({ status: 'scheduled', nextStatus: 'collected' });
    expect(res.body.timeline.map((step) => step.status)).toEqual(['received', 'scheduled']);

    const tracked = await request(app).get(`/api/donations/${code}`).expect(200);
    expect(tracked.body.status).toBe('scheduled');
    expect(tracked.body.timeline[1].at).not.toBeNull();
  });

  it('refuses to skip a step', async () => {
    const code = await createDonationViaApi(app);
    const agent = await adminAgent(app);

    const res = await agent.patch(`/api/admin/donations/${code}/status`).send({ status: 'delivered' }).expect(409);
    expect(res.body.error).toMatch(/can't move/);
  });

  it('applies only one of two simultaneous identical updates', async () => {
    const code = await createDonationViaApi(app);
    const agent = await adminAgent(app);
    const update = () => agent.patch(`/api/admin/donations/${code}/status`).send({ status: 'scheduled' });

    const statuses = (await Promise.all([update(), update()])).map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('validates the status and the code', async () => {
    const code = await createDonationViaApi(app);
    const agent = await adminAgent(app);

    await agent.patch(`/api/admin/donations/${code}/status`).send({ status: 'received' }).expect(400);
    await agent.patch(`/api/admin/donations/${code}/status`).send({ status: 'lost' }).expect(400);
    await agent.patch('/api/admin/donations/GT-ZZZZZZ/status').send({ status: 'scheduled' }).expect(404);
  });
});
