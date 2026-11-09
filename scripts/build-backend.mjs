import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { backend, root, uvEnv, execute, reportError } from './process.mjs';

async function build() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--verify') || args.length > 1) {
    throw new Error('Usage: node scripts/build-backend.mjs [--verify]');
  }
  const output = path.join(backend, 'dist');
  await execute('uv', ['build', '--wheel', '--out-dir', output], { cwd: backend, env: uvEnv });
  if (args.includes('--verify')) {
    // A fresh directory plus -I prevents the source checkout shadowing the wheel.
    const scratch = path.join(root, 'scripts/.test-output');
    await mkdir(scratch, { recursive: true });
    const cwd = await mkdtemp(path.join(scratch, 'installed wheel-'));
    await execute('uv', ['run', '--isolated', '--no-project', '--python', '3.12',
      '--with', path.join(output, 'deski_backend-0.1.0-py3-none-any.whl'),
      '--with', 'httpx==0.28.1', 'python', '-I', path.join(root, 'scripts/verify-wheel.py'),
      path.join(output, 'deski_backend-0.1.0-py3-none-any.whl'), backend], { cwd, env: uvEnv });
  }
}

build().catch(reportError);
