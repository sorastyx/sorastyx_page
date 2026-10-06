import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { collectionDetails } from './collections.mjs';
process.chdir(path.resolve(import.meta.dirname, '..'));
const config = JSON.parse(await fs.readFile('profile.config.json', 'utf8'));
const data = JSON.parse(await fs.readFile('data/profile.json', 'utf8'));
const readme = await fs.readFile('README.md', 'utf8');
if (config.favorites.length !== 7 || new Set(config.favorites.map(f => f.id)).size !== 7) throw Error('Seven distinct favorite titles are required');
if (data.calendar.days.length < 350) throw Error('Contribution calendar incomplete');
for (const favorite of config.favorites) if (!data.games.data.some(g => g.subject_id === favorite.id)) throw Error(`Missing favorite ${favorite.title}`);
const imageNames = ['header', 'favorites', 'favorites-summary', 'github', 'github-summary', 'activity', 'current-summary', 'languages', 'playing', 'watching', 'characters', 'community', 'project-fallback-0', 'project-fallback-1'];
for (const name of imageNames) {
  const meta = await sharp(`assets/generated/${name}.png`).metadata();
  if (!meta.width || !meta.height) throw Error(`Invalid image ${name}`);
}
const prefix = `https://raw.githubusercontent.com/${config.repository}/main/`;
for (const match of readme.matchAll(/src="([^"]+)"/g)) if (match[1].startsWith(prefix)) await fs.access(match[1].slice(prefix.length).split('?')[0]);
if (/ghp_|github_pat_|Bearer\s/.test(readme)) throw Error('Credential-like text in README');
const details = collectionDetails(config, data);
const favoriteIds = new Set([...config.favorites.map(f => f.id), ...(config.detailExcludedSubjects || [])]);
const ids = Object.values(details).flat().map(item => item.subject_id);
if (ids.some(id => favoriteIds.has(id)) || new Set(ids).size !== ids.length) throw Error('Detail lists repeat a favorite or another detail entry');
for (const [key, entries] of Object.entries(details)) {
  const expectedState = key.startsWith('want') ? 1 : 2;
  if (entries.some(entry => entry.type !== expectedState)) throw Error(`Unexpected collection state: ${key}`);
}
const folded = readme.slice(readme.indexOf('<summary>更多</summary>'));
if (/generated\/(favorites|playing|watching)\.png/.test(folded)) throw Error('More section repeats overview shelves');
console.log('Verified favorite identities, contribution calendar, image decoding, and all repository image links.');
