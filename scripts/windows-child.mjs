import { spawn } from 'node:child_process';
import path from 'node:path';

// Keep a live tree root after the command exits. taskkill cannot walk descendants
// of an already-dead PID. The coordinator kills this wrapper and its whole tree.
// IPC also lets us clean up if the coordinator unexpectedly disappears.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});
process.once('message', ({ command, args }) => {
  const child = spawn(command, args, { shell: false, stdio: 'inherit' });
  child.once('error', error => {
    process.send?.({ error: error.message });
  });
  child.once('exit', (code, signal) => {
    process.send?.({ code, signal });
  });
});
process.once('disconnect', () => {
  const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
  const killer = spawn(taskkill, ['/PID', String(process.pid), '/T', '/F'], {
    shell: false, stdio: 'ignore',
  });
  killer.once('error', error => {
    console.error(`Tree cleanup failed: ${error.message}`);
    process.exitCode = 1;
  });
});
