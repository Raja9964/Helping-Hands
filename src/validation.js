import * as z from 'zod';
import { CATEGORY_KEYS, STATUS_FLOW } from './domain.js';

// Optional +91 / 91 / 0 prefix, then a 10-digit mobile number starting with 6-9.
const INDIAN_MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;

function text(label, { min = 1, max, required = true }) {
  let schema = z
    .string({ error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`) })
    .trim();
  if (required) schema = schema.min(1, `${label} is required`);
  if (min > 1) schema = schema.min(min, `${label} must be at least ${min} characters`);
  return schema.max(max, `${label} must be at most ${max} characters`);
}

function optionalParam(schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

export const createDonationSchema = z.object({
  name: text('Name', { min: 2, max: 80 }),
  phone: text('Mobile number', { max: 20 })
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(INDIAN_MOBILE, 'Enter a valid 10-digit Indian mobile number'))
    .transform((value) => `+91${value.slice(-10)}`),
  category: z.enum(CATEGORY_KEYS, { error: 'Choose a donation category' }),
  address: text('Pickup address', { min: 10, max: 300 }),
  notes: text('Notes', { max: 500, required: false }).default(''),
});

export const statusUpdateSchema = z.object({
  status: z.enum(STATUS_FLOW.slice(1), {
    error: `Status must be one of: ${STATUS_FLOW.slice(1).join(', ')}`,
  }),
});

export const listQuerySchema = z.object({
  status: optionalParam(z.enum(STATUS_FLOW)),
  category: optionalParam(z.enum(CATEGORY_KEYS)),
  q: optionalParam(z.string().trim().max(80)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const loginSchema = z.object({
  password: text('Password', { max: 200 }),
});
