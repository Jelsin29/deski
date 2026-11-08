import { copyFile } from 'node:fs/promises';

for (const asset of ['index.html', 'styles.css']) {
  await copyFile(
    new URL(`../src/renderer/${asset}`, import.meta.url),
    new URL(`../dist/renderer/${asset}`, import.meta.url),
  );
}
