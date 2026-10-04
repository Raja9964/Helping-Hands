import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const secrets = { ADMIN_PASSWORD: 'long-enough', SESSION_SECRET: 's'.repeat(32) };

describe('loadConfig', () => {
  it('applies defaults and treats empty values as unset', () => {
    const config = loadConfig({ ...secrets, PORT: '' });
    expect(config.port).toBe(3000);
    expect(config.mongodbUri).toBe('mongodb://127.0.0.1:27017/givetrack');
    expect(config.isProduction).toBe(false);
  });

  it('reads values from the environment', () => {
    const config = loadConfig({ ...secrets, PORT: '8080', NODE_ENV: 'production', MONGODB_URI: 'mongodb://db/x' });
    expect(config).toMatchObject({ port: 8080, isProduction: true, mongodbUri: 'mongodb://db/x' });
  });

  it('refuses to start without the admin secrets', () => {
    expect(() => loadConfig({})).toThrow(/ADMIN_PASSWORD is required[\s\S]*SESSION_SECRET is required/);
  });

  it('rejects a short session secret', () => {
    expect(() => loadConfig({ ...secrets, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET must be at least 32/);
  });
});
