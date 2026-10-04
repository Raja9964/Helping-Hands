import mongoose from 'mongoose';
import { setTimeout as delay } from 'node:timers/promises';

export async function connectToDatabase(uri, { retries = 5, retryDelayMs = 2000, logger = console } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      return mongoose.connection;
    } catch (err) {
      if (attempt > retries) throw err;
      logger.warn(
        `MongoDB not reachable (attempt ${attempt} of ${retries + 1}): ${err.message}. Retrying in ${retryDelayMs / 1000}s`,
      );
      await delay(retryDelayMs);
    }
  }
}

export function disconnectFromDatabase() {
  return mongoose.disconnect();
}
