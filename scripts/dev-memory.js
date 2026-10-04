// Runs GiveTrack against a throwaway in-memory MongoDB with demo data,
// so the app can be tried without installing MongoDB.
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../src/config.js';
import { startServer } from '../src/server.js';
import { DEMO_TRACKING_CODE, seedDemoData } from './demo-data.js';

const DEMO_PASSWORD = 'givetrack-demo';

const mongo = await MongoMemoryServer.create();

try {
  const config = loadConfig({
    ...process.env,
    MONGODB_URI: mongo.getUri('givetrack'),
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || DEMO_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  });

  const app = await startServer(config);
  const seeded = await seedDemoData();
  const url = `http://localhost:${app.port}`;
  const password = process.env.ADMIN_PASSWORD ? '(value of ADMIN_PASSWORD)' : DEMO_PASSWORD;

  console.info(`
In-memory MongoDB ready with ${seeded} demo donations. Data is lost on exit.
  Site      ${url}
  Track     ${url}/track?code=${DEMO_TRACKING_CODE}
  Admin     ${url}/admin   password: ${password}
`);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await app.close();
      await mongo.stop();
      process.exit(0);
    });
  }
} catch (err) {
  console.error(`dev:memory failed to start: ${err.message}`);
  await mongo.stop();
  process.exit(1);
}
