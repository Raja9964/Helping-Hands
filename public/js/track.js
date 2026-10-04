import { api, formatDateTime } from './api.js';

const form = document.getElementById('track-form');
const input = document.getElementById('code');
const info = document.getElementById('tracking-info');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  track(input.value.trim());
});

const initialCode = new URLSearchParams(window.location.search).get('code');
if (initialCode) {
  input.value = initialCode;
  track(initialCode);
}

async function track(code) {
  if (!code) return;
  const url = new URL(window.location.href);
  url.searchParams.set('code', code.toUpperCase());
  history.replaceState(null, '', url);

  try {
    renderDonation(await api(`api/donations/${encodeURIComponent(code)}`));
  } catch (err) {
    renderError(err.message);
  }
}

function renderDonation(donation) {
  const steps = donation.timeline.map((step) => {
    const item = el('li', step.at ? 'complete' : '');
    if (step.status === donation.status) item.classList.add('current');
    item.append(
      el('h3', '', step.label),
      el('p', '', step.at ? formatDateTime(step.at) : 'Pending'),
    );
    return item;
  });

  const timeline = el('ul', 'timeline');
  timeline.append(...steps);

  info.className = '';
  info.replaceChildren(
    el('h2', '', `${donation.code}: ${donation.statusLabel}`),
    el('p', 'summary', `${donation.categoryLabel} donation from ${donation.firstName}`),
    timeline,
  );
  info.hidden = false;
}

function renderError(message) {
  info.className = 'error';
  info.replaceChildren(el('h2', '', 'No tracking information'), el('p', 'summary', message));
  info.hidden = false;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
