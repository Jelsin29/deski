import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DOCUMENT_LENGTH,
  findContentProblem,
  formatFileSize,
  readAttachment,
} from '../src/renderer/features/documents/attachments.ts';

test('reads text files into pending attachments', async () => {
  const file = new File(['Merhaba'], 'not.txt', { type: 'text/plain' });

  const result = await readAttachment(file, 'a1');

  assert.deepEqual(result, { ok: true, attachment: { id: 'a1', name: 'not.txt', size: file.size, content: 'Merhaba' } });
});

test('rejects binary, empty and oversized content', async () => {
  const binary = new File([new Uint8Array([0x89, 0x50, 0x00, 0xff])], 'logo.png');
  assert.deepEqual(await readAttachment(binary, 'a1'), { ok: false, name: 'logo.png', problem: 'notText' });
  assert.equal(findContentProblem('   \n'), 'empty');
  assert.equal(findContentProblem('a'.repeat(MAX_DOCUMENT_LENGTH + 1)), 'tooLarge');
});

test('formats file sizes for people', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(3 * 1024 * 1024), '3.0 MB');
});
