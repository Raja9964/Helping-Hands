export const CATEGORIES = Object.freeze({
  clothes: 'Clothes',
  footwear: 'Footwear',
  funds: 'Funds',
  gadgets: 'Gadgets',
  stationery: 'Stationery',
  food: 'Food',
});

export const STATUSES = Object.freeze({
  received: 'Received',
  scheduled: 'Scheduled for pickup',
  collected: 'Collected',
  delivered: 'Delivered',
});

export const CATEGORY_KEYS = Object.freeze(Object.keys(CATEGORIES));

// Statuses only ever move forward, one step at a time.
export const STATUS_FLOW = Object.freeze(Object.keys(STATUSES));

export function nextStatus(status) {
  const index = STATUS_FLOW.indexOf(status);
  return index === -1 ? null : (STATUS_FLOW[index + 1] ?? null);
}

export function previousStatus(status) {
  const index = STATUS_FLOW.indexOf(status);
  return index > 0 ? STATUS_FLOW[index - 1] : null;
}
