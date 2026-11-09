import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';
import { backend, root, uvEnv, reportError } from './process.mjs';

async function generate() {
  const args = process.argv.slice(2);
  let check = false;
  let output = path.join(root, 'packages/api-types/index.d.ts');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--output' && args[i + 1]) output = path.resolve(args[++i]);
    else throw new Error('Usage: node scripts/gen-types.mjs [--check] [--output FILE]');
  }
  const schema = await new Promise((resolve, reject) => {
    const child = spawn('uv', ['run', '--locked', '--quiet', 'python', path.join(root, 'scripts/export-openapi.py')], {
      cwd: backend, env: uvEnv, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) reject(new Error(`OpenAPI export failed (${code}): ${stderr.trim()}`));
      else {
        try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
      }
    });
  });
  const generated = '// Generated from app.openapi(); do not edit. Run npm run gen-types.\n'
    + astToString(await openapiTS(schema, { alphabetize: true }));
  if (check) {
    const existing = await readFile(output, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing !== generated) throw new Error('API types are stale. Run npm run gen-types.');
    console.log('API types are current.');
  } else {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, generated);
    console.log('Generated API types.');
  }
}

generate().catch(reportError);
