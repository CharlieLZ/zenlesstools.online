import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { withSocialTags } from './social-tags.mjs';
import { withStructuredData } from './structured-data.mjs';

const root = new URL('../', import.meta.url);
const sha = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full Git SHA is required for this build');
const output = new URL('dist/', root);
await mkdir(output, { recursive: true });
const staticFiles = new Set(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'og-image.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt']);
const staticDirs = new Set(['assets', 'characters', 'tools', 'admin']);
let pages = 0;
async function copyPublic(directory = '') {
  for (const entry of await readdir(new URL(directory || '.', root), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!directory && !staticDirs.has(entry.name)) continue;
      await mkdir(new URL(path + '/', output), { recursive: true });
      await copyPublic(path + '/');
    } else if (entry.isFile() && (directory || entry.name.endsWith('.html') || staticFiles.has(entry.name))) {
      if (entry.name.endsWith('.html')) {
        const html = await readFile(new URL(path, root), 'utf8');
        const versioned = html.replace(/(assets\/(?:js\/main\.js|css\/style\.css))(?:\?[^"']*)?/g, `$1?v=${sha}`);
        await writeFile(new URL(path, output), withStructuredData(withSocialTags(versioned)));
        pages++;
      } else await cp(new URL(path, root), new URL(path, output));
    }
  }
}
await copyPublic();
await mkdir(new URL('api/', output), { recursive: true });
await writeFile(new URL('api/health', output), JSON.stringify({ok: true, service: 'zenlesstools-online', buildSha: sha}));
await writeFile(new URL('_headers', output), '/api/health\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n');
console.log(JSON.stringify({sha, pages, output: 'dist'}));
