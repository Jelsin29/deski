import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { backend, root, uvEnv, reportError } from './process.mjs';

// POSIX process groups include npm/uv descendants, not just their wrapper PIDs.
// Windows has no killpg: taskkill /T /F terminates the owned process tree.
function stopTree(child, signal) {
  if (!child.pid) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise(resolve => {
      const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
      const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], {
        shell: false, stdio: 'ignore',
      });
      killer.once('error', error => { console.error(`Tree cleanup failed: ${error.message}`); resolve(); });
      killer.once('exit', resolve);
    });
  }
  try { process.kill(-child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') console.error(`Tree cleanup failed: ${error.message}`); }
  return Promise.resolve();
}

export async function runDevelopment(commands) {
  const children = [];
  let stopping = false;
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const shutdown = async code => {
    if (stopping) return;
    stopping = true;
    await Promise.all(children.map(child => stopTree(child, 'SIGTERM')));
    // Keep group IDs even after wrapper exit: descendants may ignore SIGTERM.
    if (process.platform !== 'win32') {
      await new Promise(resolve => setTimeout(resolve, 500));
      await Promise.all(children.map(child => stopTree(child, 'SIGKILL')));
    }
    await Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null || !child.pid
      ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve))));
    finish(code);
  };
  const onInterrupt = () => { void shutdown(130); };
  const onTerminate = () => { void shutdown(143); };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    for (const command of commands) {
      const windows = process.platform === 'win32';
      const child = spawn(windows ? process.execPath : command.command,
        windows ? [path.join(root, 'scripts/windows-child.mjs')] : command.args, {
          cwd: command.cwd, env: command.env ?? process.env,
          shell: false, detached: !windows,
          stdio: windows ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
        });
      children.push(child);
      if (windows) {
        child.once('spawn', () => child.send({ command: command.command, args: command.args }));
        child.on('message', message => {
          if (message.error) {
            console.error(`Unable to start ${command.name}: ${message.error}`);
            void shutdown(1);
          } else {
            void shutdown(message.code ?? (128 + (constants.signals[message.signal] ?? 1)));
          }
        });
      }
      child.once('error', error => {
        console.error(`Unable to start ${command.name}: ${error.message}`);
        void shutdown(1);
      });
      child.once('exit', (code, signal) => {
        void shutdown(code ?? (128 + (constants.signals[signal] ?? 1)));
      });
      // Catch spawn errors before attempting another command; no shell wrappers.
      await new Promise(resolve => {
        child.once('spawn', () => {
          console.log(`${command.name} started (PID ${child.pid}).`);
          resolve();
        });
        child.once('error', resolve);
      });
      if (stopping) break;
    }
    return await result;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // npm's JS entry point avoids npm.cmd / shell quoting on Windows and spaces.
  const npm = process.env.npm_execpath;
  if (!npm) reportError(new Error('Start development with npm run dev (npm_execpath is required).'));
  else {
    process.exitCode = await runDevelopment([
      { name: 'backend', command: 'uv', args: ['run', '--locked', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], cwd: backend, env: uvEnv },
      { name: 'desktop', command: process.execPath, args: [npm, 'run', 'dev:desktop'], cwd: root },
    ]);
  }
}
