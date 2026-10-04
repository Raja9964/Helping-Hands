// Resizes and recompresses the site images in place. Safe to re-run: files
// already within their width and size budget are left alone.
import { readFile, stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const KB = 1024;
const TARGETS = [
  { file: 'public/img/hero.jpg', width: 1920, maxBytes: 400 * KB },
  { file: 'public/img/img-2.jpeg', width: 700, maxBytes: 120 * KB },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ file: `public/img/miss/${n}.jpg`, width: 1000, maxBytes: 150 * KB })),
  ...['book', 'clothing', 'gadgets', 'salary', 'shopping-bag', 'sneakers'].map((name) => ({
    file: `public/img/don/${name}.png`,
    width: 140,
    maxBytes: 20 * KB,
  })),
];

for (const { file, width, maxBytes } of TARGETS) {
  const before = (await stat(file)).size;
  const input = await readFile(file);
  const meta = await sharp(input).metadata();

  if (meta.width <= width && before <= maxBytes) {
    console.info(`skip  ${file} (${kb(before)})`);
    continue;
  }

  const pipeline = sharp(input).resize({ width, withoutEnlargement: true });
  const output =
    meta.format === 'png'
      ? await pipeline.png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer()
      : await pipeline.jpeg({ quality: 72, mozjpeg: true, progressive: true }).toBuffer();

  await writeFile(file, output);
  console.info(`done  ${file} ${kb(before)} -> ${kb(output.length)}`);
}

function kb(bytes) {
  return `${Math.round(bytes / KB)} KB`;
}
