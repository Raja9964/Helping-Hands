import { CATEGORIES, STATUSES, STATUS_FLOW, nextStatus } from '../domain.js';

// Everything served by the public tracking endpoint goes through this
// allow-list, so new fields on the model are private by default.
export function toPublicView(donation) {
  const reachedAt = new Map(donation.timeline.map((entry) => [entry.status, entry.at]));

  return {
    code: donation.code,
    firstName: firstNameOf(donation.name),
    category: donation.category,
    categoryLabel: CATEGORIES[donation.category],
    status: donation.status,
    statusLabel: STATUSES[donation.status],
    createdAt: donation.createdAt,
    timeline: STATUS_FLOW.map((status) => ({
      status,
      label: STATUSES[status],
      at: reachedAt.get(status) ?? null,
    })),
  };
}

export function firstNameOf(name) {
  return name.trim().split(/\s+/)[0];
}

export function toAdminView(donation) {
  const next = nextStatus(donation.status);

  return {
    code: donation.code,
    name: donation.name,
    phone: donation.phone,
    category: donation.category,
    categoryLabel: CATEGORIES[donation.category],
    address: donation.address,
    notes: donation.notes,
    status: donation.status,
    statusLabel: STATUSES[donation.status],
    nextStatus: next,
    nextStatusLabel: next ? STATUSES[next] : null,
    timeline: donation.timeline.map(({ status, at }) => ({ status, label: STATUSES[status], at })),
    createdAt: donation.createdAt,
    updatedAt: donation.updatedAt,
  };
}
