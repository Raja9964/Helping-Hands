// Builds the GitHub Pages demo: public/ as-is, plus demo/ bundled with the real
// validation and views so the API runs in the browser.
// Usage: node scripts/build-pages.js [outDir]   (BASE_PATH defaults to /Helping-Hands)
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const basePath = (process.env.BASE_PATH ?? '/Helping-Hands').replace(/\/+$/, '');
if (basePath && !basePath.startsWith('/')) {
  throw new Error(`BASE_PATH should look like /Helping-Hands, got "${basePath}"`);
}

// GitHub Pages maps /track to track.html but plain static servers don't, so link to the files.
const PAGES = ['thank-you', 'track', 'admin'];
const pageLink = new RegExp(`(["'\`])(${PAGES.join('|')})(?=[?#"'\`])`, 'g');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data:",
  // Nothing typed into the demo can leave the browser.
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'self'",
].join('; ');

await rm(outDir, { recursive: true, force: true });
await cp(path.join(root, 'public'), outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'demo/main.js')],
  outfile: path.join(outDir, 'demo/demo.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [browserCrypto()],
});
for (const file of ['demo.css', 'not-found.js']) {
  await cp(path.join(root, 'demo', file), path.join(outDir, 'demo', file));
}

for (const page of ['index', ...PAGES]) {
  await update(`${page}.html`, (html) => {
    const withDemo = replaceOnce(
      html,
      '<script type="module"',
      '<link rel="stylesheet" href="demo/demo.css">\n  <script type="module" src="demo/demo.js"></script>\n  <script type="module"',
    );
    return addCsp(withDemo).replace(pageLink, '$1$2.html');
  });
}
for (const script of await readdir(path.join(outDir, 'js'))) {
  await update(`js/${script}`, (js) => js.replace(pageLink, '$1$2.html'));
}

// Pages serves 404.html at any depth, so it needs the base path to find its files.
const notFound = await readFile(path.join(root, 'demo/404.html'), 'utf8');
await writeFile(path.join(outDir, '404.html'), addCsp(replaceOnce(notFound, '<base href="/">', `<base href="${basePath}/">`)));

console.info(`Pages demo built in ${path.relative(root, outDir) || '.'} for ${basePath || '/'}`);

function addCsp(html) {
  return replaceOnce(html, '<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`);
}

async function update(file, transform) {
  const target = path.join(outDir, file);
  await writeFile(target, transform(await readFile(target, 'utf8')));
}

function replaceOnce(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`build-pages: expected to find ${search}`);
  return text.replace(search, () => replacement);
}

// src/lib/donation-code.js imports randomInt from node:crypto.
function browserCrypto() {
  return {
    name: 'browser-crypto',
    setup(bundle) {
      bundle.onResolve({ filter: /^node:crypto$/ }, () => ({ path: path.join(root, 'demo/random.js') }));
    },
  };
}
