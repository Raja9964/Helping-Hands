import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, donationInput, testApp, useTestDatabase } from './helpers.js';

useTestDatabase();

let server;
let baseUrl;

beforeAll(async () => {
  server = testApp().listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

async function readUntil(reader, pattern) {
  const decoder = new TextDecoder();
  let text = '';
  while (!pattern.test(text)) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`Stream ended before ${pattern}`);
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function sendJson(path, method, body, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/events', () => {
  it('streams new donations and status changes to a logged-in admin', async () => {
    const login = await sendJson('/api/admin/login', 'POST', { password: ADMIN_PASSWORD });
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const controller = new AbortController();
    const stream = await fetch(`${baseUrl}/api/admin/events`, { headers: { Cookie: cookie }, signal: controller.signal });
    expect(stream.headers.get('content-type')).toMatch(/text\/event-stream/);
    const reader = stream.body.getReader();
    await readUntil(reader, /retry: \d+/);

    const created = await sendJson('/api/donations', 'POST', donationInput()).then((res) => res.json());
    const createdEvent = await readUntil(reader, /event: donation\.created\ndata: .+\n\n/);
    expect(createdEvent).toContain(`"code":"${created.code}"`);

    await sendJson(`/api/admin/donations/${created.code}/status`, 'PATCH', { status: 'scheduled' }, cookie);
    const updatedEvent = await readUntil(reader, /event: donation\.updated\ndata: .+\n\n/);
    expect(updatedEvent).toContain('"status":"scheduled"');

    controller.abort();
  });
});
