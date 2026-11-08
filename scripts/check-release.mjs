// Guard rails before a production deploy:
//   1. Working tree must be clean (what you deploy == what is committed).
//   2. HEAD must carry the tag v<package.json version> (created by `npm run release:*`).
//   3. public/version.js and public/sw.js must match package.json.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

if (sh('git status --porcelain')) fail('Hay cambios sin commit. Haz commit antes de publicar.');

const tagsAtHead = sh('git tag --points-at HEAD').split(/\s+/).filter(Boolean);
if (!tagsAtHead.includes(tag)) {
  fail(`HEAD no tiene el tag ${tag}. Usa "npm run release:patch|minor|major" para crear la versión.`);
}

if (!readFileSync('public/version.js', 'utf8').includes(`'${version}'`)) fail('public/version.js no coincide con package.json (corre "npm run sync-version").');
if (!readFileSync('public/sw.js', 'utf8').includes(`const APP_VERSION = '${version}';`)) fail('public/sw.js no coincide con package.json (corre "npm run sync-version").');

console.log(`✔ Listo para publicar ${tag} (${sh('git rev-parse --short HEAD')})`);

