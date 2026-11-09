import { runDevelopment } from '../../dev.mjs';
import { fileURLToPath } from 'node:url';
const [mode, dir] = process.argv.slice(2);
const fixture = fileURLToPath(new URL('./process.mjs', import.meta.url));
const command = role => ({ name: role, command: process.execPath, args: [fixture, role, dir], cwd: dir });
const peer = mode === 'spawn-error'
  ? { name: 'missing', command: 'deski-deliberately-missing-command', args: [], cwd: dir }
  : command(mode);
process.on('message', message => {
  if (message === 'interrupt') process.emit('SIGINT');
});
process.exitCode = await runDevelopment([command('tree'), peer]);
if (process.connected) process.disconnect();
