import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(here, 'app.js');
let source = readFileSync(appPath, 'utf8');
const marker = '/* LiveTV v0.7.0 operator enhancer */';

if (!source.includes(marker)) {
  const oldItem = `      const item = {\n        start, stop,\n        title: extractTag(match[2], 'title') || 'Programa',\n        desc: extractTag(match[2], 'desc'),\n        category: extractTag(match[2], 'category')\n      };`;
  const newItem = `      const item = {\n        start, stop,\n        title: extractTag(match[2], 'title') || 'Programa',\n        desc: extractTag(match[2], 'desc'),\n        category: extractTag(match[2], 'category'),\n        icon: ((match[2].match(/<icon\\b[^>]*\\bsrc=\"([^\"]+)\"/i) || [])[1] || '')\n      };`;
  if (!source.includes(oldItem)) throw new Error('Could not patch EPG item parser');
  source = source.replace(oldItem, newItem);

  const guideRefresh = `  if (playerMode) updateGuideDrawer(false);`;
  if (!source.includes(guideRefresh)) throw new Error('Could not patch guide refresh guard');
  source = source.replace(guideRefresh, `  if (playerMode && !window.__LiveTVV070Installed) updateGuideDrawer(false);`);

  source += `\n\n${marker}\nimport { installOperatorV070 } from './v070-enhancer.js';\nwindow.__LiveTVV070Installed = true;\ninstallOperatorV070({\n  channels,\n  channelById,\n  video,\n  get current(){ return current; },\n  get epgLoaded(){ return epgLoaded; },\n  play,\n  loadEpg,\n  nowProgramme,\n  upcomingProgrammes,\n  formatClock,\n  enterPlayerMode,\n  exitPlayerMode,\n  setStatus\n});\n`;
  writeFileSync(appPath, source);
}

console.log('LiveTV v0.7.0 web player layer applied.');
