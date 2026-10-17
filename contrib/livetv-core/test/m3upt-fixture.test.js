import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseM3U } from '../src/m3u-parser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = await readFile(path.join(root, 'fixtures', 'M3UPT.m3u'), 'utf8');
const channels = parseM3U(text, { source: 'fixture:M3UPT' });

test('embedded M3UPT snapshot parses into a large usable catalogue', () => {
  assert.ok(channels.length > 900, `expected >900 playable entries, got ${channels.length}`);
  const rtp1 = channels.find((channel) => channel.id === 'RTP1.pt');
  assert.ok(rtp1, 'RTP 1 should be present');
  assert.equal(rtp1.headers.Origin, 'https://www.rtp.pt');
  assert.equal(rtp1.headers.Referer, 'https://www.rtp.pt/play/direto/rtp1');
  assert.ok(rtp1.headers['User-Agent']);
  assert.equal(rtp1.headers['User-Agent'].startsWith('"'), false);
  assert.match(rtp1.logo, /RTP1\.pt\.png/i);
});

test('commented M3UPT entries do not leak metadata into the following channel', () => {
  assert.equal(channels.some((channel) => channel.id === 'TVIAfrica.pt'), false);
  const vplus = channels.find((channel) => channel.id === 'VPlusTVI.pt');
  assert.ok(vplus, 'V+ TVI should be present');
  assert.equal(vplus.headers.Origin, 'https://tviplayer.iol.pt');
  assert.equal(vplus.headers.Referer, 'https://tviplayer.iol.pt');
  assert.ok(vplus.headers['User-Agent']);
});
