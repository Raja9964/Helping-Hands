import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const PAGES = ['index.html', 'thank-you.html', 'track.html', 'admin.html'];
let outDir;

beforeAll(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), 'helping-hands-pages-'));
  execFileSync(process.execPath, [path.join(root, 'scripts/build-pages.js'), outDir], {
    env: { ...process.env, BASE_PATH: '/Helping-Hands' },
    stdio: 'pipe',
  });
});

afterAll(() => rm(outDir, { recursive: true, force: true }));

const read = (file) => readFile(path.join(outDir, file), 'utf8');

describe('GitHub Pages build', () => {
  it.each(PAGES)('%s loads the demo before the page script and blocks network requests', async (page) => {
    const html = await read(page);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html.indexOf('src="demo/demo.js"')).toBeGreaterThan(0);
    expect(html.indexOf('src="demo/demo.js"')).toBeLessThan(html.indexOf('src="js/'));
  });

  it('only uses relative URLs that a plain static host can serve', async () => {
    const scripts = (await readdir(path.join(outDir, 'js'))).map((file) => `js/${file}`);
    for (const file of [...PAGES, ...scripts]) {
      const text = await read(file);
      expect(text, file).not.toMatch(/(?:href|src)="\/(?!\/)/);
      expect(text, file).not.toMatch(/["'`]\/api\//);
      expect(text, file).not.toMatch(/["'`](?:track|admin|thank-you)["'`?#]/);
    }
    expect(await read('index.html')).toContain('href="track.html"');
    expect(await read('js/home.js')).toContain('`thank-you.html?code=');
  });

  it('bundles the demo for the browser', async () => {
    const bundle = await read('demo/demo.js');
    expect(bundle).not.toMatch(/\bnode:|\brequire\(/);
    expect(bundle.length).toBeLessThan(150_000);
  });

  it('gives the 404 page the base path', async () => {
    const html = await read('404.html');
    expect(html).toContain('<base href="/Helping-Hands/">');
    expect(html).toContain('src="demo/not-found.js"');
  });
});
