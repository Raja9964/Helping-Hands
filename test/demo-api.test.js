import { describe, expect, it } from 'vitest';
import { createDemoApi } from '../demo/api.js';
import { randomInt } from '../demo/random.js';
import { DEMO_ADMIN_PASSWORD, DEMO_TRACKING_CODE } from '../scripts/demo-data.js';
import { donationInput } from './helpers.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

function setup({ admin = false } = {}) {
  const events = [];
  const api = createDemoApi({ storage: memoryStorage(), publish: (type, data) => events.push({ type, data }) });
  const call = (method, path, options) => api.request(method, path, options);
  if (admin) call('POST', 'admin/login', { body: { password: DEMO_ADMIN_PASSWORD } });
  return { api, call, events };
}

describe('demo API: donations', () => {
  it('starts with the sample donations', () => {
    const { call } = setup({ admin: true });

    expect(call('GET', 'admin/stats').body.total).toBe(12);
    expect(call('GET', `donations/${DEMO_TRACKING_CODE}`).body).toMatchObject({ firstName: 'Priya', status: 'collected' });
  });

  it('creates a donation with a code in the server format', () => {
    const { call, events } = setup();

    const res = call('POST', 'donations', { body: donationInput({ name: '  Priya Sharma  ', status: 'delivered' }) });

    expect(res).toEqual({ status: 201, body: { code: expect.stringMatching(/^HH-[2-9A-HJKMNP-TV-Z]{6}$/), firstName: 'Priya' } });
    expect(events).toEqual([{ type: 'donation.created', data: expect.objectContaining({ code: res.body.code, status: 'received' }) }]);
  });

  it('applies the server validation rules', () => {
    const { call } = setup();

    const phone = call('POST', 'donations', { body: donationInput({ phone: '5845012345' }) });
    expect(phone.status).toBe(400);
    expect(phone.body.details).toEqual([{ field: 'phone', message: 'Enter a valid 10-digit Indian mobile number' }]);

    const empty = call('POST', 'donations', { body: {} });
    expect(empty.body.details.map((d) => d.field)).toEqual(['name', 'phone', 'category', 'address']);
  });

  it('tracks a donation without personal details', () => {
    const { call } = setup();
    const { code } = call('POST', 'donations', { body: donationInput() }).body;

    const res = call('GET', `donations/${code.replace('-', '').toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['category', 'categoryLabel', 'code', 'createdAt', 'firstName', 'status', 'statusLabel', 'timeline'].sort(),
    );
    const raw = JSON.stringify(res.body);
    for (const secret of ['9845012345', 'Sharma', 'Indiranagar', 'winter wear']) {
      expect(raw).not.toContain(secret);
    }
    expect(call('GET', 'donations/hello').status).toBe(400);
    expect(call('GET', 'donations/HH-ZZZZZZ').status).toBe(404);
  });
});

describe('demo API: admin', () => {
  it('needs the demo password', () => {
    const { call } = setup();

    expect(call('GET', 'admin/donations').status).toBe(401);
    expect(call('POST', 'admin/login', { body: { password: 'nope-nope' } })).toEqual({ status: 401, body: { error: 'Incorrect password' } });
    expect(call('POST', 'admin/login', { body: { password: DEMO_ADMIN_PASSWORD } }).status).toBe(204);
    expect(call('GET', 'admin/session').body).toEqual({ authenticated: true });

    call('POST', 'admin/logout');
    expect(call('GET', 'admin/stats').status).toBe(401);
  });

  it('filters, searches and pages the list', () => {
    const { call } = setup({ admin: true });
    const list = (query) => call('GET', 'admin/donations', { query }).body;

    expect(list({ category: 'food' }).items.map((d) => d.name)).toEqual(['Vikram Iyer', 'Fatima Khan']);
    expect(list({ q: '7k3p' }).items.map((d) => d.code)).toEqual([DEMO_TRACKING_CODE]);
    const lastPage = list({ limit: '5', page: '3' });
    expect(lastPage).toMatchObject({ total: 12, page: 3, pages: 3 });
    expect(lastPage.items).toHaveLength(2);
    expect(call('GET', 'admin/donations', { query: { status: 'lost' } }).status).toBe(400);
  });

  it('moves a donation forward one step at a time', () => {
    const { call, events } = setup({ admin: true });
    const { code } = call('POST', 'donations', { body: donationInput() }).body;
    const move = (status) => call('PATCH', `admin/donations/${code}/status`, { body: { status } });

    expect(move('delivered')).toMatchObject({ status: 409, body: { error: expect.stringMatching(/can't move/) } });
    expect(move('scheduled')).toMatchObject({ status: 200, body: { status: 'scheduled', nextStatus: 'collected' } });
    expect(move('scheduled').status).toBe(409);
    expect(move('received').status).toBe(400);
    expect(call('PATCH', 'admin/donations/HH-ZZZZZZ/status', { body: { status: 'scheduled' } }).status).toBe(404);

    expect(events.at(-1)).toMatchObject({ type: 'donation.updated', data: { code, status: 'scheduled' } });
    expect(call('GET', `donations/${code}`).body.timeline[1].at).not.toBeNull();
  });

  it('resets to the sample data', () => {
    const { api, call } = setup({ admin: true });
    call('POST', 'donations', { body: donationInput() });

    api.reset();

    expect(call('GET', 'admin/stats').body.total).toBe(12);
    expect(call('GET', 'admin/session').body.authenticated).toBe(true);
  });

  it('answers unknown routes with JSON', () => {
    const { call } = setup();
    expect(call('GET', 'nope')).toEqual({ status: 404, body: { error: 'Not found' } });
    expect(call('GET', 'admin/login').status).toBe(404);
  });
});

describe('browser randomInt', () => {
  it('stays in range', () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i++) seen.add(randomInt(30));
    expect([...seen].every((n) => Number.isInteger(n) && n >= 0 && n < 30)).toBe(true);
    expect(seen.size).toBe(30);
  });
});
