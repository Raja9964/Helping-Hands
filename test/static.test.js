import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { testApp } from './helpers.js';

const app = testApp();

describe('static site', () => {
  it.each(['/', '/thank-you', '/track', '/admin'])('serves %s with a strict CSP', async (path) => {
    const res = await request(app).get(path).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it.each(['/package.json', '/src/app.js', '/.env', '/.git/config', '/../package.json'])(
    'does not expose %s',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('"dependencies"');
    },
  );

  it('answers unknown API routes with JSON', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
