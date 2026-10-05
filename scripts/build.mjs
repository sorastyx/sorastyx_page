import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import MarkdownIt from 'markdown-it';

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
const colors = { ink: '#253d32', muted: '#758174', gold: '#ad8952', border: '#e1dfd2', paper: '#faf9f3', green: '#526b4b' };
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
  const tasks = {
    github: () => request(gh), repos: () => request(`${gh}/repos?per_page=100`),
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
const text = (x, y, value, size = 20, fill = colors.ink, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const rect = (x, y, w, h, fill, radius = 0, stroke = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" ${stroke ? `stroke="${stroke}"` : ''}/>`;
const heading = (title, subtitle) => text(30, 43, title, 25, colors.ink, 'font-weight="700"') + text(30, 70, subtitle, 14, colors.muted);
const wrap = (body, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="round"><rect width="${width}" height="${height}" rx="18"/></clipPath></defs><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" clip-path="url(#round)">${rect(0, 0, width, height, colors.paper)}${body}</g><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="18" fill="none" stroke="${colors.border}"/></svg>`;
async function card(name, body, width, height, svgOnly = false) {
  const svg = wrap(body, width, height);
  if (svgOnly) await fs.writeFile(`${out}/${name}.svg`, svg);
  else await sharp(Buffer.from(svg)).png().toFile(`${out}/${name}.png`);
}
const art = `data:image/png;base64,${(await fs.readFile('assets/source/forest-with-title.png')).toString('base64')}`;
await card('header', `<image href="${art}" x="20" y="20" width="257" height="430" preserveAspectRatio="xMidYMid meet"/>`
  + text(325, 70, 'A SMALL CORNER OF MY WORLD', 14, colors.gold, 'letter-spacing="3"')
  + text(321, 151, config.github, 76, colors.ink, 'font-family="Georgia, serif"')
  + text(325, 200, config.displayName, 27, colors.green)
  + `<path d="M325 232H928" stroke="${colors.border}"/>`
  + text(325, 291, config.signature, 30)
  + `<path d="M890 28C905 95 940 100 969 169M893 42Q862 60 882 82M903 85Q935 64 947 89" fill="none" stroke="${colors.border}" stroke-width="2"/>`, 1000, 470);

const favoriteEntries = config.favorites.map(f => {
  const entry = snapshot.games.data.find(g => g.subject_id === f.id);
  if (!entry) throw new Error(`Favorite ${f.title} (${f.id}) missing from collection`);
  return { ...entry, displayTitle: f.title, subtitle: f.subtitle };
});
let favorites = heading('心之所向 · Favorite Stories', '七部喜欢的作品，七段不同的世界。');
for (const [i, entry] of favoriteEntries.entries()) {
  const x = 30 + i * 137;
  const data = await imageData(entry.subject.images?.large || entry.subject.images?.common);
  if (!data) throw new Error(`Favorite cover unavailable: ${entry.displayTitle}; retain the previous published card.`);
  favorites += rect(x, 97, 118, 166, '#eeece3', 5);
  if (data) favorites += `<image href="${data}" x="${x}" y="97" width="118" height="166" preserveAspectRatio="xMidYMid meet"/>`;
  favorites += text(x + 59, 291, entry.displayTitle, 18, colors.ink, 'text-anchor="middle" font-weight="700"');
  favorites += text(x + 59, 314, trim(entry.subtitle, 20), 10, colors.muted, 'text-anchor="middle"');
}
await card('favorites', favorites, 1000, 345);

const owned = snapshot.repos.filter(r => !r.fork);
const stars = owned.reduce((n, repo) => n + repo.stargazers_count, 0);
let stats = heading('代码的足迹 · GitHub', `公开数据 · 贡献日历 ${snapshot.calendar.days[0].date} — ${snapshot.calendar.days.at(-1).date}`);
const statItems = [[snapshot.calendar.total, '年度贡献'], [snapshot.github.public_repos, '公开仓库'], [stars, '自有仓库 Stars'], [snapshot.github.followers, 'Followers'], [snapshot.github.following, 'Following']];
for (const [i, [value, label]] of statItems.entries()) {
  const x = 30 + i * 190;
  stats += text(x, 123, value, 35, colors.green, 'font-weight="700"') + text(x, 150, label, 14, colors.muted);
}
const levels = ['#e9ebdf', '#c8d1b3', '#99ad85', '#688661', '#355b43'];
for (const [i, day] of snapshot.calendar.days.entries()) {
  const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
  stats += rect(30 + Math.floor(i / 7) * 17.7, 179 + row * 17.7, 13, 13, levels[day.level], 3);
}
stats += text(30, 330, '每一格，都是一点点向前。', 15, colors.muted);
stats += text(966, 330, snapshot.sources.calendar, 12, colors.muted, 'text-anchor="end"');
await card('github', stats, 1000, 354);

for (const [i, name] of config.projects.entries()) {
  const repo = snapshot.repos.find(r => r.name === name);
  if (!repo) throw new Error(`Project not found: ${name}`);
  const descriptions = name === 'JLU-' ? ['吉林大学软件工程学习经验与资料', '将课程中的积累，分享给后来的人。'] : ['从零实现 Transformer 机器翻译模型', '用代码理解注意力与序列建模。'];
  await card(`project-fallback-${i}`, text(26, 48, name, 27, colors.ink, 'font-weight="700"') + text(26, 91, descriptions[0], 18, colors.muted) + text(26, 122, descriptions[1], 15, colors.muted) + text(26, 171, `★ ${repo.stargazers_count}    ⑂ ${repo.forks_count}    ${repo.language || 'Learning materials'}`, 14, colors.gold), 485, 198);
}

async function shelf(name, title, subtitle, entries, emptyLabel) {
  const height = entries.length ? 96 + Math.ceil(entries.length / 2) * 142 : 174;
  let body = heading(title, subtitle);
  if (!entries.length) body += text(30, 124, emptyLabel, 17, colors.muted);
  for (const [i, entry] of entries.entries()) {
    const x = 30 + (i % 2) * 485, y = 97 + Math.floor(i / 2) * 142;
    const cover = await imageData(entry.subject.images?.common || entry.subject.images?.large);
    body += rect(x, y, 76, 111, '#eeece3', 4);
    if (cover) body += `<image href="${cover}" x="${x}" y="${y}" width="76" height="111" preserveAspectRatio="xMidYMid slice"/>`;
    const cnTitle = entry.subject.name_cn || entry.subject.name;
    body += text(x + 91, y + 25, trim(cnTitle, 18), 17, colors.ink, 'font-weight="700"');
    body += text(x + 91, y + 53, trim(entry.subject.name, 31), 12, colors.muted);
    body += text(x + 91, y + 83, entry.subject.type === 2 ? `看到第 ${entry.ep_status || 0} 集` : '游玩中', 14, colors.green);
    body += text(x + 91, y + 109, entry.rate ? `我的评分 ${entry.rate} / 10` : '尚未评分', 12, colors.muted);
  }
  await card(name, body, 1000, height);
}
const playing = snapshot.games.data.filter(g => g.type === 3).slice(0, config.playingLimit);
const watching = snapshot.anime.data.filter(g => g.type === 3).slice(0, config.watchingLimit);
await shelf('playing', '仍在旅途中 · Now Playing', `${snapshot.games.data.filter(g => g.type === 2).length} 部游戏已玩 · ${snapshot.games.data.filter(g => g.type === 3).length} 部正在游玩 · Bangumi`, playing, '暂时没有正在游玩的作品。');
await shelf('watching', '屏幕那一端 · Watching', `${snapshot.anime.data.filter(g => g.type === 2).length} 部动画看过 · ${snapshot.anime.data.filter(g => g.type === 3).length} 部正在追番 · Bangumi`, watching, '暂时没有正在追的动画。');

let people = heading('相遇与同行 · Community', `${snapshot.github.followers} 位关注者 · 关注 ${snapshot.github.following} 人`);
for (const [row, key] of ['followers', 'following'].entries()) {
  people += text(30, 110 + row * 102, row ? '我关注的人' : '关注我的人', 15, colors.muted);
  for (const [i, user] of snapshot[key].slice(0, config.peopleLimit).entries()) {
    const data = await imageData(user.avatar_url);
    const x = 163 + i * 49, y = 85 + row * 102;
    if (data) people += `<image href="${data}" x="${x}" y="${y}" width="38" height="38"/>`;
  }
}
people += text(30, 288, 'Recently starred', 17, colors.gold);
for (const [i, repo] of snapshot.starred.entries()) people += text(30, 322 + i * 30, trim(repo.full_name, 80), 16, colors.ink);
await card('community', people, 1000, 415);

let charactersBody = heading('记忆中的面孔 · Characters', 'Bangumi 收藏的虚构角色');
const charHeight = snapshot.characters.length ? 228 : 165;
if (!snapshot.characters.length) charactersBody += text(30, 123, '角色收藏还是一片空白，留给下一次心动。', 18, colors.muted);
for (const [i, character] of snapshot.characters.entries()) {
  const data = await imageData(character.image);
  const x = 30 + i * 79;
  if (data) charactersBody += `<image href="${data}" x="${x}" y="93" width="64" height="83" preserveAspectRatio="xMidYMid slice"/>`;
  charactersBody += text(x + 32, 200, trim(character.name, 6), 11, colors.ink, 'text-anchor="middle"');
}
await card('characters', charactersBody, 1000, charHeight);

const raw = `https://raw.githubusercontent.com/${config.repository}/main`;
const pin = i => fs.access(`${out}/project-${i}.svg`).then(() => `${raw}/${out}/project-${i}.svg`).catch(() => `${raw}/${out}/project-fallback-${i}.png`);
const image = (name, alt) => `<p><img src="${raw}/${out}/${name}.png" width="100%" alt="${alt}"></p>`;
const typing = 'https://readme-typing-svg.demolab.com?font=Fira+Code&size=18&duration=3500&pause=1200&color=526B4B&center=true&vCenter=true&width=760&height=45&lines=Welcome+to+my+little+forest.;Visual+novels%2C+anime%2C+and+lines+of+code.';
const metricsExists = await fs.access(`${out}/metrics.svg`).then(() => true).catch(() => false);
const readme = `<div align="center">\n\n${image('header', 'sorastyx · Forest · 追求视觉小说美的极限。')}\n\n<img src="${typing}" width="100%" alt="Welcome to my little forest.">\n\n[GitHub](https://github.com/${config.github}) · [Bangumi](https://bangumi.tv/user/${config.bangumi})\n\n</div>\n\n### 🌿 写下的故事 · Projects\n\n<a href="https://github.com/${config.github}/${config.projects[0]}"><img src="${await pin(0)}" width="49%" alt="${esc(config.projects[0])}"></a>\n<a href="https://github.com/${config.github}/${config.projects[1]}"><img src="${await pin(1)}" width="49%" alt="${esc(config.projects[1])}"></a>\n\n${image('github', 'GitHub 公开统计与年度贡献日历')}\n\n${image('favorites', '喜欢的作品：樱之诗、樱之刻、I/O、Ever17、素晴日、命运石之门、Forest')}\n\n<p align="center">${config.favorites.map(f => `<a href="https://bangumi.tv/subject/${f.id}">${f.title}</a>`).join(' · ')}</p>\n\n${image('playing', '正在游玩的游戏')}\n\n${image('watching', '正在追的动画')}\n\n${image('characters', '收藏的角色')}\n\n${image('community', '关注者、关注列表与最近 Star 的项目')}\n\n<p align="center"><a href="https://github.com/${config.github}?tab=followers">关注者</a> · <a href="https://github.com/${config.github}?tab=following">我关注的人</a> · <a href="https://bgm.tv/user/${config.bangumi}/mono/character">收藏角色</a></p>\n\n${metricsExists ? `<details>\n<summary>更多代码足迹 · Languages / Calendar / Stars</summary>\n\n<img src="${raw}/${out}/metrics.svg" width="100%" alt="lowlighter metrics">\n\n</details>\n\n` : ''}<div align="center">\n\n**你是这片森林的又一位来访者**\n\n<img src="https://count.getloli.com/@sorastyx-profile?name=sorastyx-profile&amp;theme=${config.counterTheme}&amp;padding=7&amp;offset=0&amp;align=top&amp;scale=1&amp;pixelated=1&amp;darkmode=auto" width="75%" alt="初音主题访问计数">\n\n<sub>愿每一个故事，都在这里留下回声。</sub>\n\n</div>\n`;
await fs.writeFile('README.md', readme);
const md = new MarkdownIt({ html: true });
let preview = md.render(readme).replaceAll(`${raw}/`, './');
await fs.writeFile('preview.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>sorastyx · README 初稿</title><style>body{margin:0;background:#fff;color:#1f2328;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}.bar{padding:17px 30px;background:#f6f8fa;border-bottom:1px solid #d1d9e0;font-size:14px}.bar b{color:#0969da}.readme{max-width:960px;margin:28px auto;padding:30px;border:1px solid #d1d9e0;border-radius:8px;line-height:1.65}.readme img{max-width:100%;height:auto;vertical-align:middle}.readme p{margin:18px 0}.readme h3{padding-bottom:8px;border-bottom:1px solid #d1d9e0}a{color:#526b4b;text-decoration:none}a:hover{text-decoration:underline}summary{cursor:pointer}@media(max-width:600px){.readme{margin:12px 6px;padding:12px}.bar{padding:12px}.readme sub{font-size:10px}}</style><div class="bar"><b>sorastyx / sorastyx_page</b> &nbsp; · &nbsp; README.md</div><main class="readme">${preview}</main></html>`);
await fs.writeFile('data/build-report.json', JSON.stringify({ date: snapshot.fetchedAt, sources: snapshot.sources, favorites: favoriteEntries.length, playing: playing.length, watching: watching.length, characters: snapshot.characters.length, warnings }, null, 2) + '\n');
if (warnings.length) console.warn(warnings.join('\n'));
console.log(`Built profile: ${favoriteEntries.length} favorites, ${playing.length} playing, ${watching.length} watching, ${snapshot.characters.length} characters.`);
