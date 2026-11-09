import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const node = process.execPath;
const env = { ...process.env, UV_PYTHON_DOWNLOADS: 'never', UV_CACHE_DIR: path.join(root, 'scripts/.cache/uv') };
function run(args) {
  return spawnSync(node, args, { cwd: root, env, encoding: 'utf8', timeout: 120000 });
}
async function scratch() {
  await mkdir(path.join(root, 'scripts/.test-output'), { recursive: true });
  return mkdtemp(path.join(root, 'scripts/.test-output/case with spaces-'));
}
function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
}

test('generation uses public OpenAPI, is deterministic, and stale check never overwrites', async () => {
  const dir = await scratch();
  const output = path.join(dir, 'contract.d.ts');
  const first = run(['scripts/gen-types.mjs', '--output', output]);
  success(first);
  assert.equal(first.stdout, 'Generated API types.\n');
  assert.equal(first.stderr, '');
  const original = await readFile(output, 'utf8');
  for (const route of ['health', 'chat', 'documents', 'settings', 'tokens/{provider}']) {
    assert.ok(original.includes(`/api/v1/${route}`), route);
  }
  success(run(['scripts/gen-types.mjs', '--output', output]));
  assert.equal(await readFile(output, 'utf8'), original);
  const fresh = run(['scripts/gen-types.mjs', '--check', '--output', output]);
  success(fresh);
  assert.equal(fresh.stdout, 'API types are current.\n');
  assert.equal(fresh.stderr, '');
  await writeFile(output, 'stale\n');
  const stale = run(['scripts/gen-types.mjs', '--check', '--output', output]);
  assert.equal(stale.status, 1);
  assert.equal(stale.stdout, '');
  assert.equal(stale.stderr, 'API types are stale. Run npm run gen-types.\n');
  assert.equal(await readFile(output, 'utf8'), 'stale\n');
});

test('prior root desktop scripts retain their exact commands', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['dev:desktop'], 'npm run dev --workspace @deski/desktop');
  for (const name of ['typecheck', 'test', 'build']) {
    assert.equal(pkg.scripts[name], `npm run ${name} --workspace @deski/desktop`);
  }
});

async function lifecycle(mode, expected, interrupt = false) {
  const dir = await scratch();
  const child = spawn(node, ['scripts/test/fixtures/dev-runner.mjs', mode, dir], {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal })));
  if (interrupt) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('fixture never ready')), 10000);
      child.stdout.on('data', () => {
        if (stdout.includes('READY')) { clearTimeout(timeout); resolve(); }
      });
    });
    // Node's Windows child.kill('SIGINT') force-terminates rather than delivering
    // a console event. Inject that event there; POSIX exercises the real signal.
    if (process.platform === 'win32') child.send('interrupt');
    else child.kill('SIGINT');
  }
  assert.deepEqual(await exited, { code: expected, signal: null }, stderr);
  if (mode === 'spawn-error') assert.match(stderr, /Unable to start missing:/);
  else assert.equal(stderr, '');
  const recorded = await readFile(path.join(dir, 'pids'), 'utf8').catch(error => {
    if (error.code === 'ENOENT' && mode === 'spawn-error') return '';
    throw error;
  });
  const pids = [...recorded.trim().split('\n').filter(Boolean).map(Number),
    ...Array.from(stdout.matchAll(/PID (\d+)/g), match => Number(match[1]))];
  assert.ok(pids.length >= 1);
  for (const pid of pids) {
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, `lingering PID ${pid}`);
  }
  return stdout;
}
test('nonzero child exit propagates and kills sibling plus grandchild', { timeout: 20000 }, async () => {
  assert.match(await lifecycle('failure', 7), /READY/);
});
test('spawn failure exits 1 and cleans already-started sibling', { timeout: 20000 }, async () => {
  await lifecycle('spawn-error', 1);
});
test('Ctrl-C exits 130 and cleans process trees', { timeout: 20000 }, async () => {
  await lifecycle('wait', 130, true);
});
test('normal child exit stops sibling without fabricating a failure', { timeout: 20000 }, async () => {
  await lifecycle('success', 0);
});

test('Windows ownership wrapper retains a live tree root after command exit or spawn error', { timeout: 10000 }, async () => {
  for (const command of [
    { command: node, args: ['-e', 'process.exit(7)'] },
    { command: 'deski-deliberately-missing-command', args: [] },
  ]) {
    const wrapper = spawn(node, ['scripts/windows-child.mjs'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const exited = new Promise(resolve => wrapper.once('exit', resolve));
    try {
      const message = new Promise(resolve => wrapper.once('message', resolve));
      wrapper.send(command);
      const result = await message;
      if (command.command === node) assert.deepEqual(result, { code: 7, signal: null });
      else assert.match(result.error, /ENOENT/);
      assert.equal(wrapper.exitCode, null);
      assert.equal(wrapper.signalCode, null);
      assert.doesNotThrow(() => process.kill(wrapper.pid, 0));
    } finally {
      wrapper.kill('SIGKILL');
      await exited;
    }
  }
});

test('wheel contains only app modules/metadata and installed health works outside source', { timeout: 120000 }, () => {
  const result = run(['scripts/build-backend.mjs', '--verify']);
  success(result);
  assert.match(result.stdout, /Installed wheel health verified: 200/);
});
