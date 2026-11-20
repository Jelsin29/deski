import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown } from '../src/renderer/features/chat/markdown.ts';

test('escapes HTML so replies can never inject markup', () => {
  assert.equal(
    renderMarkdown('<img src=x onerror="alert(1)">'),
    '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
  );
});

test('renders paragraphs, line breaks, bold, italic and inline code', () => {
  assert.equal(
    renderMarkdown('**Kalın** ve *eğik*\n`kod <b>`\n\nİkinci'),
    '<p><strong>Kalın</strong> ve <em>eğik</em><br><code>kod &lt;b&gt;</code></p><p>İkinci</p>',
  );
});

test('renders lists and headings', () => {
  assert.equal(renderMarkdown('# Başlık'), '<h3>Başlık</h3>');
  assert.equal(renderMarkdown('- bir\n- iki'), '<ul><li>bir</li><li>iki</li></ul>');
  assert.equal(renderMarkdown('1. bir\n2. iki'), '<ol><li>bir</li><li>iki</li></ol>');
});

test('starts a list right after a paragraph line', () => {
  assert.equal(
    renderMarkdown('Sağlayıcılar:\n- Anthropic\n- OpenAI\nSon satır'),
    '<p>Sağlayıcılar:</p><ul><li>Anthropic</li><li>OpenAI</li></ul><p>Son satır</p>',
  );
});

test('keeps fenced code literal, including unclosed fences', () => {
  assert.equal(
    renderMarkdown('Örnek:\n```ts\nconst a = **1** < 2;\n```\nSon'),
    '<p>Örnek:</p><pre><code>const a = **1** &lt; 2;</code></pre><p>Son</p>',
  );
  assert.equal(renderMarkdown('```\nyarım'), '<pre><code>yarım</code></pre>');
});
