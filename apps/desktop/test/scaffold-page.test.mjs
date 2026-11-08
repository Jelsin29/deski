import assert from 'node:assert/strict';
import test from 'node:test';
import { renderScaffoldPage } from '../src/renderer/pages/scaffold-page.ts';

function expectedPage(title) {
  return `<main><h1>${title}</h1><p>Desktop foundation</p><p>This static scaffold has no AI, RAG, database, or backend connection.</p></main>`;
}

test('renders the initial static page with semantic content', () => {
  assert.equal(renderScaffoldPage('Deski'), expectedPage('Deski'));
});

test('renders markup and quotes in the title as text, never executable HTML', () => {
  assert.equal(
    renderScaffoldPage('<img src=x onerror="alert(1)"> & \'Deski\''),
    expectedPage('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;Deski&#39;'),
  );
});
