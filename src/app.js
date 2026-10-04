import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { donationsRouter } from './routes/donations.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function createApp({ config, logger = console }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          // Local dev runs over plain http.
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
    }),
  );

  app.use(
    express.static(publicDir, {
      dotfiles: 'deny',
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
    }),
  );

  if (config.env !== 'test') app.use('/api', requestLogger(logger));
  app.use('/api', express.json({ limit: '10kb' }), cookieParser(config.sessionSecret));
  app.use('/api/donations', donationsRouter({ config }));
  app.use('/api/admin', adminRouter({ config }));
  app.use('/api', apiNotFound);

  app.use((req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
  });
  app.use(errorHandler(logger));

  return app;
}

// Method, path and status only; query strings can contain donor names.
function requestLogger(logger) {
  return (req, res, next) => {
    const started = performance.now();
    const route = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      const ms = Math.round(performance.now() - started);
      logger.info(`${req.method} ${route} ${res.statusCode} ${ms}ms`);
    });
    next();
  };
}
