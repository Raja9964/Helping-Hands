import { z } from 'zod';
import { CATEGORY_KEYS } from './domain.js';

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
