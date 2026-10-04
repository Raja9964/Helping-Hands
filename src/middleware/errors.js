import { HttpError } from '../lib/http-error.js';

export function apiNotFound(req, res, next) {
  next(new HttpError(404, 'Not found'));
}

export function errorHandler(logger) {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const { status, body } = describe(err);
    if (status >= 500) {
      // Log the error, never the request body: it holds names, phones and addresses.
      logger.error(`${req.method} ${req.path} failed:`, err);
    }
    res.status(status).json(body);
  };
}

function describe(err) {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: err.message, details: err.details } };
  }
  if (err.type === 'entity.parse.failed') {
    return { status: 400, body: { error: 'Request body must be valid JSON' } };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, body: { error: 'Request body is too large' } };
  }
  if (err.expose && err.status < 500) {
    return { status: err.status, body: { error: err.message } };
  }
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
}
