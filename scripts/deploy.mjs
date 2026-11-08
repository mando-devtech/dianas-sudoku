// Production deploy: runs the release checks, then publishes public/ with the Netlify CLI,
// labeling the deploy with the version and commit so it is identifiable in the Netlify UI.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

execSync('node scripts/check-release.mjs', { stdio: 'inherit' });

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const message = `v${version} (${sha})`;

execSync(`npx netlify deploy --prod --dir=public --message "${message}"`, { stdio: 'inherit' });
console.log(`\n✔ Publicado ${message}. Recuerda: git push --follow-tags`);

