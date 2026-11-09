import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const backend = path.join(root, 'apps/backend');
export const uvEnv = {
  ...process.env,
  UV_PYTHON_DOWNLOADS: 'never',
  UV_CACHE_DIR: path.join(root, 'scripts/.cache/uv'),
};

export function execute(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal ?? code})`));
    });
  });
}

export function reportError(error) {
  console.error(error.message);
  process.exitCode = 1;
}
