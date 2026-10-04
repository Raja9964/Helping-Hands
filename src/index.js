import { loadConfig } from './config.js';
import { startServer } from './server.js';

try {
  const app = await startServer(loadConfig());

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      console.info(`${signal} received, shutting down`);
      await app.close();
      process.exit(0);
    });
  }
} catch (err) {
  console.error(`Helping Hands failed to start: ${err.message}`);
  process.exit(1);
}
