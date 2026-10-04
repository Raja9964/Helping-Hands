// Entry point of the GitHub Pages build. The pages from public/ run unchanged;
// their api/ requests are answered here and never reach a server.
import { DEMO_ADMIN_PASSWORD } from '../scripts/demo-data.js';
import { createDemoApi } from './api.js';

const REPO_URL = 'https://github.com/Raja9964/Helping-Hands';
const apiRoot = new URL('../api/', import.meta.url);

const live = liveChannel('helping-hands-demo');
const api = createDemoApi({ storage: browserStorage(), publish: live.publish });

serveApiInBrowser();
replaceEventSource();
showBanner();
showDemoPassword();

function serveApiInBrowser() {
  const networkFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(apiRoot.href)) return networkFetch(input, init);

    const url = new URL(request.url);
    const text = await request.text();
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      return jsonResponse(400, { error: 'Request body must be valid JSON' });
    }

    const res = api.request(request.method, url.pathname.slice(apiRoot.pathname.length), {
      body,
      query: Object.fromEntries(url.searchParams),
    });
    return jsonResponse(res.status, res.body);
  };
}

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Same events as the server's SSE stream, so admin.js needs no changes.
function replaceEventSource() {
  const NetworkEventSource = window.EventSource;
  const feedUrl = new URL('admin/events', apiRoot).href;

  window.EventSource = class extends EventTarget {
    constructor(url, options) {
      super();
      this.url = new URL(url, location.href).href;
      if (this.url !== feedUrl) return new NetworkEventSource(url, options);
      this.readyState = 0;
      setTimeout(() => this.connect());
    }

    connect() {
      if (this.readyState === 2) return;
      if (!api.isAdmin()) {
        this.readyState = 2;
        this.dispatchEvent(new Event('error'));
        return;
      }
      this.readyState = 1;
      this.unsubscribe = live.subscribe(({ type, data }) => {
        this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
      });
      this.dispatchEvent(new Event('open'));
    }

    close() {
      this.readyState = 2;
      this.unsubscribe?.();
    }
  };
}

// Stands in for the server's event hub: this tab hears its own events at once,
// other open tabs hear them over a BroadcastChannel.
function liveChannel(name) {
  const listeners = new Set();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(name) : null;
  channel?.addEventListener('message', ({ data }) => listeners.forEach((listener) => listener(data)));

  return {
    publish(type, data) {
      const event = { type, data };
      listeners.forEach((listener) => listener(event));
      channel?.postMessage(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function browserStorage() {
  try {
    localStorage.setItem('helping-hands-demo:probe', '1');
    localStorage.removeItem('helping-hands-demo:probe');
    return localStorage;
  } catch {
    // Storage is blocked (some private windows), so keep data for this page only.
    const items = new Map();
    return {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, String(value)),
      removeItem: (key) => items.delete(key),
    };
  }
}

function showBanner() {
  const text = el('p', 'hh-demo-text');
  text.append(el('strong', '', 'Live demo'), ' · runs in your browser with sample data · the full app uses Node.js + MongoDB');

  const actions = el('div', 'hh-demo-actions');
  if (!document.getElementById('login-view')) actions.append(link('admin.html', 'Admin dashboard'));

  const source = link(REPO_URL, 'View source');
  source.target = '_blank';
  source.rel = 'noopener noreferrer';

  const reset = el('button', '', 'Reset data');
  reset.type = 'button';
  reset.title = 'Bring back the 12 sample donations';
  reset.addEventListener('click', () => {
    api.reset();
    location.reload();
  });
  actions.append(source, reset);

  const banner = el('aside', 'hh-demo-banner');
  banner.setAttribute('aria-label', 'About this demo');
  banner.append(text, actions);
  document.body.prepend(banner);

  // Keeps the bottom of each page clear of the fixed bar.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--hh-demo-banner-height', `${banner.offsetHeight}px`);
  }).observe(banner);
}

function showDemoPassword() {
  const heading = document.querySelector('#login-view h1');
  if (!heading) return;

  const fill = el('button', '', 'Fill in');
  fill.type = 'button';
  fill.addEventListener('click', () => {
    const input = document.getElementById('password');
    input.value = DEMO_ADMIN_PASSWORD;
    input.focus();
  });

  const hint = el('div', 'hh-demo-hint');
  hint.append(el('span', 'hh-demo-label', 'Demo password'), el('code', '', DEMO_ADMIN_PASSWORD), fill);
  heading.after(hint);
}

function link(href, text) {
  const anchor = el('a', '', text);
  anchor.href = href;
  return anchor;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
