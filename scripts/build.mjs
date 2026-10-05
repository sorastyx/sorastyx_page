import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { renderProfile } from './render.mjs';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const config = JSON.parse(await fs.readFile('profile.config.json', 'utf8'));
const offline = process.argv.includes('--offline');
const out = 'assets/generated';
const media = 'assets/source/media';
await fs.mkdir(out, { recursive: true });
await fs.mkdir(media, { recursive: true });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const trim = (s, n) => [...String(s ?? '')].length > n ? [...s].slice(0, n - 1).join('') + '…' : String(s ?? '');
const warnings = [];
async function request(url, json = true) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { 'User-Agent': 'sorastyx-profile/1.0 (https://github.com/sorastyx/sorastyx_page)' };
      if (new URL(url).hostname === 'api.github.com' && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return json ? await response.json() : await response.text();
    } catch (e) { error = e; }
  }
  throw error;
}
async function collections(type) {
  const data = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await request(`https://api.bgm.tv/v0/users/${config.bangumi}/collections?subject_type=${type}&limit=100&offset=${offset}`);
    data.push(...page.data);
    if (data.length >= page.total || !page.data.length) return { total: page.total, data };
  }
  throw new Error('Bangumi collection pagination exceeded safety limit');
}
function contributions(html) {
  const counts = new Map();
  for (const match of html.matchAll(/<tool-tip\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g)) {
    counts.set(match[1], Number(match[2].replace(/<[^>]*>/g, '').match(/([\d,]+) contributions?/)?.[1]?.replaceAll(',', '') || 0));
  }
  const days = [...html.matchAll(/<td\b[^>]*data-date="[^" ]+"[^>]*>/g)].map(([tag]) => ({
    date: tag.match(/data-date="([^"]+)"/)[1],
    level: Number(tag.match(/data-level="(\d)"/)?.[1] || 0),
    count: counts.get(tag.match(/id="([^"]+)"/)?.[1]) ?? 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 350) throw new Error('GitHub contribution calendar format changed');
  return { days, total: days.reduce((n, day) => n + day.count, 0) };
}
function characters(html) {
  const result = [];
  for (const block of html.split(/<li\b/).slice(1)) {
    const id = block.match(/href="\/character\/(\d+)"/)?.[1];
    if (!id || result.some(c => c.id === id)) continue;
    const image = block.match(/(?:src|data-cfsrc)="([^"]*\/pic\/crt\/[^" ]+)"/)?.[1];
    const name = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/)?.[1] || block.match(/title="([^"]+)"/)?.[1] || `角色 ${id}`;
    result.push({ id, name, image: image?.startsWith('//') ? `https:${image}` : image });
  }
  if (!html.includes('收藏的虚构角色')) throw new Error('Bangumi character page format changed');
  return result.slice(0, config.characterLimit);
}
let snapshot;
if (!offline) {
  const gh = `https://api.github.com/users/${config.github}`;
  const reposPromise = request(`${gh}/repos?per_page=100`);
  const tasks = {
    github: () => request(gh), repos: () => reposPromise,
    languages: async () => {
      const excluded = new Set([config.repository, ...(config.languageExcludedRepositories || [])]);
      const repos = (await reposPromise).filter(r => !r.fork && !excluded.has(r.full_name));
      const totals = {};
      for (const languages of await Promise.all(repos.map(r => request(r.languages_url)))) {
        for (const [language, bytes] of Object.entries(languages)) totals[language] = (totals[language] || 0) + bytes;
      }
      return totals;
    },
    followers: () => request(`${gh}/followers?per_page=${config.peopleLimit}`),
    following: () => request(`${gh}/following?per_page=${config.peopleLimit}`),
    starred: () => request(`${gh}/starred?per_page=3&sort=created&direction=desc`),
    games: () => collections(4), anime: () => collections(2),
    calendar: async () => contributions(await request(`https://github.com/users/${config.github}/contributions`, false)),
    characters: async () => characters(await request(`https://bgm.tv/user/${config.bangumi}/mono/character`, false)),
  };
  const settled = await Promise.allSettled(Object.values(tasks).map(fn => fn()));
  let previous = {};
  try { previous = JSON.parse(await fs.readFile('data/profile.json', 'utf8')); } catch {}
  snapshot = { fetchedAt: new Date().toISOString().slice(0, 10), sources: {} };
  for (const [index, key] of Object.keys(tasks).entries()) {
    if (settled[index].status === 'fulfilled') {
      snapshot[key] = settled[index].value;
      snapshot.sources[key] = snapshot.fetchedAt;
    } else if (previous[key]) {
      snapshot[key] = previous[key];
      snapshot.sources[key] = previous.sources?.[key] || previous.fetchedAt;
      warnings.push(`${key}: cached snapshot retained; ${settled[index].reason.message}`);
    } else throw settled[index].reason;
  }
  await fs.writeFile('data/profile.json', JSON.stringify(snapshot, null, 2) + '\n');
} else snapshot = JSON.parse(await fs.readFile('data/profile.json', 'utf8'));

async function imageData(url) {
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 20);
  const filename = `${media}/${hash}.png`;
  let buffer;
  try { buffer = await fs.readFile(filename); }
  catch {
    if (offline) { warnings.push(`No cached image: ${url}`); return ''; }
    try {
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(url, { headers: { 'User-Agent': 'sorastyx-profile/1.0' }, signal: AbortSignal.timeout(20000) });
          if (response.ok) break;
        } catch (e) { if (attempt === 2) throw e; }
      }
      if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
      buffer = await sharp(Buffer.from(await response.arrayBuffer())).resize(360, 540, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      await fs.writeFile(filename, buffer);
    } catch (e) { warnings.push(`Image unavailable: ${url}: ${e.message}`); return ''; }
  }
  return `data:image/png;base64,${buffer.toString('base64')}`;
}
await renderProfile({ config, snapshot, imageData, warnings, out });
if (warnings.length) console.warn(warnings.join('\n'));
console.log('Built profile with plain headings and detailed public data.');
