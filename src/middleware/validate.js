import { HttpError } from '../lib/http-error.js';

export function parseOrThrow(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.message,
  }));
  throw new HttpError(400, 'Please check the highlighted fields', details);
}

export function validateBody(schema) {
  return (req, res, next) => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}
