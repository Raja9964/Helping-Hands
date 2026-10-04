import mongoose from 'mongoose';
import { CATEGORY_KEYS, STATUS_FLOW } from '../domain.js';

const timelineEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_FLOW, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const donationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 80 },
    phone: { type: String, required: true },
    category: { type: String, enum: CATEGORY_KEYS, required: true },
    address: { type: String, required: true, maxlength: 300 },
    notes: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: STATUS_FLOW, default: STATUS_FLOW[0] },
    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true },
);

donationSchema.index({ createdAt: -1 });
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ category: 1, createdAt: -1 });

export const Donation = mongoose.models.Donation ?? mongoose.model('Donation', donationSchema);
