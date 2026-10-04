import { api, formatDateTime } from './api.js';

const STATUS_LABELS = {
  received: 'Received',
  scheduled: 'Scheduled for pickup',
  collected: 'Collected',
  delivered: 'Delivered',
};
const CATEGORY_LABELS = {
  clothes: 'Clothes',
  footwear: 'Footwear',
  funds: 'Funds',
  gadgets: 'Gadgets',
  stationery: 'Stationery',
  food: 'Food',
};

const $ = (id) => document.getElementById(id);
const state = { page: 1, pages: 1, flashCode: null };
let liveFeed;
let refreshTimer;

init();

async function init() {
  const { authenticated } = await api('api/admin/session');
  if (authenticated) showDashboard();
  else showLogin();

  $('login-form').addEventListener('submit', login);
  $('logout').addEventListener('click', logout);
  $('filters').addEventListener('input', debounce(() => {
    state.page = 1;
    refresh();
  }, 250));
  $('filters').addEventListener('submit', (event) => event.preventDefault());
  $('prev-page').addEventListener('click', () => changePage(-1));
  $('next-page').addEventListener('click', () => changePage(1));
  $('donation-rows').addEventListener('click', advance);
}

function showLogin() {
  liveFeed?.close();
  $('login-view').hidden = false;
  $('dashboard-view').hidden = true;
  $('logout').hidden = true;
  $('live-status').hidden = true;
  $('password').focus();
}

function showDashboard() {
  $('login-view').hidden = true;
  $('dashboard-view').hidden = false;
  $('logout').hidden = false;
  refresh();
  connectLiveFeed();
}

async function login(event) {
  event.preventDefault();
  $('login-error').textContent = '';
  try {
    await api('api/admin/login', { method: 'POST', body: { password: $('password').value } });
    $('login-form').reset();
    showDashboard();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
}

async function logout() {
  await api('api/admin/logout', { method: 'POST' });
  showLogin();
}

async function refresh() {
  try {
    const params = new URLSearchParams({ page: state.page });
    for (const [key, value] of new FormData($('filters'))) {
      if (value.trim()) params.set(key, value.trim());
    }
    const [list, stats] = await Promise.all([
      api(`api/admin/donations?${params}`),
      api('api/admin/stats'),
    ]);
    state.pages = list.pages;
    renderStats(stats);
    renderRows(list);
    $('dashboard-error').hidden = true;
  } catch (err) {
    if (err.status === 401) return showLogin();
    showError(err.message);
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 300);
}

function connectLiveFeed() {
  liveFeed?.close();
  const status = $('live-status');
  status.hidden = false;
  liveFeed = new EventSource('api/admin/events');

  liveFeed.addEventListener('open', () => {
    status.textContent = 'Live';
    status.classList.add('online');
  });
  liveFeed.addEventListener('error', () => {
    status.textContent = 'Reconnecting...';
    status.classList.remove('online');
  });
  for (const type of ['donation.created', 'donation.updated']) {
    liveFeed.addEventListener(type, (event) => {
      state.flashCode = JSON.parse(event.data).code;
      scheduleRefresh();
    });
  }
}

async function advance(event) {
  const button = event.target.closest('button[data-next]');
  if (!button) return;
  button.disabled = true;
  try {
    await api(`api/admin/donations/${button.dataset.code}/status`, {
      method: 'PATCH',
      body: { status: button.dataset.next },
    });
    state.flashCode = button.dataset.code;
    await refresh();
  } catch (err) {
    if (err.status === 401) return showLogin();
    showError(err.message);
    refresh();
  }
}

function changePage(delta) {
  const page = state.page + delta;
  if (page < 1 || page > state.pages) return;
  state.page = page;
  refresh();
}

function renderStats({ total, byStatus, byCategory }) {
  const cards = [['total', 'Total donations', total], ...Object.entries(byStatus).map(([key, count]) => [key, STATUS_LABELS[key], count])];
  $('status-stats').replaceChildren(
    ...cards.map(([key, label, count]) => {
      const card = el('div', `stat ${key}`);
      card.append(el('span', 'value', String(count)), el('span', 'label', label));
      return card;
    }),
  );

  $('category-stats').replaceChildren(
    ...Object.entries(byCategory).map(([key, count]) => {
      const chip = el('span', 'category-chip', CATEGORY_LABELS[key]);
      chip.append(el('strong', '', String(count)));
      return chip;
    }),
  );
}

function renderRows({ items, total, page, pages }) {
  const rows = items.map((donation) => {
    const row = el('tr');
    if (donation.code === state.flashCode) row.classList.add('flash');

    const code = el('td');
    code.append(el('code', '', donation.code));

    const donor = el('td', '', donation.name);
    donor.append(el('span', 'phone', donation.phone));

    const address = el('td', '', donation.address);
    if (donation.notes) address.append(el('span', 'notes', donation.notes));

    const status = el('td');
    status.append(el('span', `status-badge ${donation.status}`, donation.statusLabel));

    const action = el('td', 'text-right');
    if (donation.nextStatus) {
      const button = el('button', 'btn btn-sm btn-dark', `Mark ${donation.nextStatusLabel.toLowerCase()}`);
      button.type = 'button';
      button.dataset.code = donation.code;
      button.dataset.next = donation.nextStatus;
      action.append(button);
    } else {
      action.append(el('span', 'text-muted small', 'Complete'));
    }

    row.append(code, donor, el('td', '', donation.categoryLabel), address, el('td', '', formatDateTime(donation.createdAt)), status, action);
    return row;
  });

  if (!rows.length) {
    const empty = el('td', 'text-center text-muted py-4', 'No donations match these filters.');
    empty.colSpan = 7;
    const row = el('tr');
    row.append(empty);
    rows.push(row);
  }

  $('donation-rows').replaceChildren(...rows);
  $('result-count').textContent = `${total} result${total === 1 ? '' : 's'}`;
  $('page-label').textContent = `Page ${page} of ${pages}`;
  $('prev-page').disabled = page <= 1;
  $('next-page').disabled = page >= pages;
  state.flashCode = null;
}

function showError(message) {
  $('dashboard-error').textContent = message;
  $('dashboard-error').hidden = false;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
