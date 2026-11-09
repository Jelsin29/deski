import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const [role, dir] = process.argv.slice(2);
const pids = path.join(dir, 'pids');
if (role === 'tree' || role === 'leaf') {
  appendFileSync(pids, `${process.pid}\n`);
  if (role === 'tree') spawn(process.execPath, [import.meta.filename, 'leaf', dir], { stdio: 'inherit' });
  if (role === 'leaf') console.log('READY');
  setInterval(() => {}, 1000);
} else if (role === 'wait') {
  setInterval(() => {}, 1000);
} else {
  const timer = setInterval(() => {
    if (existsSync(pids)) {
      clearInterval(timer);
      // Allow the sibling grandchild to initialize before exercising cleanup.
      setTimeout(() => process.exit(role === 'failure' ? 7 : 0), 300);
    }
  }, 10);
}
