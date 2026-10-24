#!/usr/bin/env node
/**
 * Runs every automated check in order and prints a summary.
 *
 *   node scripts/test-all.mjs              # everything
 *   node scripts/test-all.mjs --quick      # skip the slow backend suite (mvn test)
 *   node scripts/test-all.mjs --no-smoke   # skip the end-to-end smoke test
 *   node scripts/test-all.mjs --no-build   # skip the frontend production build
 *
 * Needs Java 21 + Maven, Node.js and a running Docker daemon (the backend tests start PostgreSQL with
 * Testcontainers). The smoke test needs the app running: docker compose up -d --build
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const color = process.stdout.isTTY ? (c, s) => `\x1b[${c}m${s}\x1b[0m` : (_, s) => s;

const steps = [
  { name: 'Backend unit and integration tests', dir: 'backend', cmd: 'mvn -B -q test', skip: args.has('--quick') },
  { name: 'Frontend install', dir: 'frontend', cmd: 'npm ci --no-audit --no-fund', skip: args.has('--no-install') },
  { name: 'Frontend type check', dir: 'frontend', cmd: 'npm run lint' },
  { name: 'Frontend production build', dir: 'frontend', cmd: 'npm run build', skip: args.has('--no-build') },
  { name: 'End-to-end smoke test (running app)', dir: '.', cmd: 'node scripts/smoke-test.mjs', skip: args.has('--no-smoke') },
];

const results = [];
for (const step of steps) {
  if (step.skip) { results.push({ ...step, outcome: 'skipped' }); continue; }
  console.log(`\n${color(1, `▶ ${step.name}`)}  ${color(2, `(${step.dir}: ${step.cmd})`)}`);
  const started = Date.now();
  const run = spawnSync(step.cmd, { cwd: path.join(root, step.dir), stdio: 'inherit', shell: true });
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ ...step, outcome: run.status === 0 ? 'passed' : 'failed', seconds });
  // A failed install leaves nothing to type-check or build.
  if (run.status !== 0 && step.name === 'Frontend install') break;
}

console.log(`\n${color(1, 'Summary')}`);
for (const r of results) {
  const label = r.outcome === 'passed' ? color(32, 'PASS') : r.outcome === 'failed' ? color(31, 'FAIL') : color(33, 'SKIP');
  console.log(`  ${label}  ${r.name}${r.seconds !== undefined ? color(2, `  ${r.seconds}s`) : ''}`);
}
const failed = results.some(r => r.outcome === 'failed');
console.log(failed ? color(31, '\nSome checks failed.') : color(32, '\nAll checks passed.'));
process.exit(failed ? 1 : 0);
