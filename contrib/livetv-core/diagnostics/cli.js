import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { probePlaylist } from '../src/diagnostics.js';
import { parseM3U } from '../src/m3u-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function args(argv) {
  const out = { limit: 0, concurrency: 6, timeout: 10000, output: 'm3upt-diagnostics.json', segment: true };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    const [key, inline] = value.split('=', 2);
    const take = () => inline ?? argv[++i];
    if (key === '--limit') out.limit = Number(take() || 0);
    else if (key === '--concurrency') out.concurrency = Number(take() || 6);
    else if (key === '--timeout') out.timeout = Number(take() || 10000);
    else if (key === '--out') out.output = take() || out.output;
    else if (key === '--no-segment') out.segment = false;
  }
  return out;
}

const options = args(process.argv.slice(2));
const [playlistText, metaText] = await Promise.all([
  readFile(path.join(root, 'fixtures', 'M3UPT.m3u'), 'utf8'),
  readFile(path.join(root, 'fixtures', 'M3UPT.meta.json'), 'utf8')
]);
const snapshot = JSON.parse(metaText);
let channels = parseM3U(playlistText, { source: 'embedded:M3UPT' });
if (options.limit > 0) channels = channels.slice(0, options.limit);

let completed = 0;
const startedAt = new Date().toISOString();
const results = await probePlaylist(channels, {
  concurrency: options.concurrency,
  timeoutMs: options.timeout,
  probeSegment: options.segment,
  onResult: (result, index, total) => {
    completed += 1;
    const http = [result.http.manifest, result.http.variant, result.http.segment].filter((x) => x != null).join('/');
    console.log(`[${completed}/${total}] ${result.status.toUpperCase().padEnd(7)} ${String(index + 1).padStart(4)} ${result.name} ${http ? `HTTP ${http}` : ''}`);
  }
});

const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  acc.total += 1;
  return acc;
}, { total: 0, ok: 0, http: 0, timeout: 0, error: 0 });

const report = {
  generatedAt: new Date().toISOString(),
  startedAt,
  snapshot,
  options,
  summary,
  results
};
await writeFile(path.resolve(options.output), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Report: ${path.resolve(options.output)}`);
console.log(`Summary: ${JSON.stringify(summary)}`);
