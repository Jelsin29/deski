// Files chosen in the composer are read as text in the renderer and sent to
// POST /documents as content, because the backend contract never accepts
// filesystem paths.

/** Matches the backend limit on document content (characters). */
export const MAX_DOCUMENT_LENGTH = 1_000_000;

/** File types the picker suggests; content is still validated after reading. */
export const ACCEPTED_FILE_TYPES = [
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml',
  '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.go',
  '.rs', '.php', '.rb', '.sql', '.sh', '.log', '.ini', '.toml',
].join(',');

export interface PendingAttachment {
  id: string;
  name: string;
  size: number;
  content: string;
}

export type AttachmentProblem = 'tooLarge' | 'notText' | 'empty' | 'unreadable';

export type AttachmentResult =
  | { ok: true; attachment: PendingAttachment }
  | { ok: false; name: string; problem: AttachmentProblem };

export function findContentProblem(content: string): AttachmentProblem | null {
  if (content.length > MAX_DOCUMENT_LENGTH) return 'tooLarge';
  // Binary files decode with NUL characters or replacement characters.
  if (content.includes('\u0000') || content.includes('�')) return 'notText';
  if (content.trim().length === 0) return 'empty';
  return null;
}

export async function readAttachment(file: File, id: string): Promise<AttachmentResult> {
  // UTF-8 uses at most 4 bytes per character; skip reading files that cannot fit.
  if (file.size > MAX_DOCUMENT_LENGTH * 4) return { ok: false, name: file.name, problem: 'tooLarge' };

  let content: string;
  try {
    content = await file.text();
  } catch {
    return { ok: false, name: file.name, problem: 'unreadable' };
  }

  const problem = findContentProblem(content);
  if (problem) return { ok: false, name: file.name, problem };
  return { ok: true, attachment: { id, name: file.name, size: file.size, content } };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
