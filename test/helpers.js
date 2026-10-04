import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { Donation } from '../src/models/donation.js';

export const ADMIN_PASSWORD = 'correct-horse-battery';
export const SESSION_SECRET = 'test-secret-that-is-at-least-32-chars';

export function testApp({ rateLimits } = {}) {
  const config = {
    ...loadConfig({ NODE_ENV: 'test', ADMIN_PASSWORD, SESSION_SECRET }),
    rateLimits: { createDonation: 1000, trackDonation: 1000, login: 1000, ...rateLimits },
  };
  return createApp({ config, logger: { info() {}, warn() {}, error() {} } });
}

export function useTestDatabase() {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Donation.init();
  });
  beforeEach(() => Donation.deleteMany({}));
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

export function donationInput(overrides = {}) {
  return {
    name: 'Priya Sharma',
    phone: '98450 12345',
    category: 'clothes',
    address: '14, 2nd Cross, Indiranagar, Bengaluru',
    notes: 'Two bags of winter wear',
    ...overrides,
  };
}

export async function createDonationViaApi(app, overrides) {
  const res = await request(app).post('/api/donations').send(donationInput(overrides)).expect(201);
  return res.body.code;
}

export async function adminAgent(app) {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ password: ADMIN_PASSWORD }).expect(204);
  return agent;
}
