import http from 'node:http';
import { once } from 'node:events';
import { createApp } from './app.js';
import { connectToDatabase, disconnectFromDatabase } from './db.js';

export async function startServer(config, { logger = console } = {}) {
  await connectToDatabase(config.mongodbUri, { logger });

  const server = http.createServer(createApp({ config, logger }));
  server.listen(config.port);
  await once(server, 'listening');

  const { port } = server.address();
  logger.info(`GiveTrack running at http://localhost:${port}`);

  let closing;
  const close = () => {
    closing ??= (async () => {
      await new Promise((resolve) => server.close(resolve));
      await disconnectFromDatabase();
    })();
    return closing;
  };

  return { server, port, close };
}
