import { cp } from 'node:fs/promises';

// tsc only emits JavaScript; static renderer files are copied next to it.
const copies = [
  ['src/renderer/index.html', 'dist/renderer/index.html'],
  ['src/renderer/styles', 'dist/renderer/styles'],
  ['assets/logo.svg', 'dist/renderer/assets/logo.svg'],
];

for (const [source, target] of copies) {
  await cp(new URL(`../${source}`, import.meta.url), new URL(`../${target}`, import.meta.url), {
    recursive: true,
  });
}
