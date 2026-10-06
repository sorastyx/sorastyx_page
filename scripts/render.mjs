import fs from 'node:fs/promises';
import sharp from 'sharp';
import MarkdownIt from 'markdown-it';
import { composeReadme } from './readme.mjs';
import { collectionDetails } from './collections.mjs';
import crypto from 'node:crypto';

const C = { text: '#1f2328', muted: '#656d76', blue: '#0969da', line: '#d8dee4' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const t = (x, y, value, size = 16, fill = C.text, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const r = (x, y, width, height, fill, radius = 0) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;
const line = (y, width = 490) => `<path d="M12 ${y}H${width - 12}" stroke="${C.line}"/>`;
const title = (name, width = 490) => t(12, 30, name, 21, C.blue) + line(45, width);
const short = (value, max) => [...String(value || '')].length > max ? [...value].slice(0, max - 1).join('') + '…' : String(value || '');
function splitText(value, width) {
  const lines = [''];
  let length = 0;
  for (const character of String(value || '')) {
    const size = /[\u2e80-\uffff]/.test(character) ? 1 : .55;
    if (length + size > width) { lines.push(''); length = 0; }
    lines[lines.length - 1] += character;
    length += size;
  }
  return lines;
}
const svg = (body, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${r(0, 0, width, height, '#ffffff')}${body}</g></svg>`;
function streaks(days) {
  let best = 0, run = 0;
  for (const day of days) { run = day.count > 0 ? run + 1 : 0; best = Math.max(best, run); }
  let cursor = days.length - 1;
  if (!days[cursor].count) cursor--;
  let current = 0;
  for (; cursor >= 0 && days[cursor].count > 0; cursor--) current++;
  return { best, current, active: days.filter(day => day.count > 0).length };
}
function chart(values, labels, x, y, width, height) {
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => [x + i * width / Math.max(1, values.length - 1), y + height - v / max * height]);
  let body = '';
  for (const value of [0, Math.ceil(max / 2), max]) {
    const row = y + height - value / max * height;
    body += `<path d="M${x} ${row}H${x + width}" stroke="#eaeef2" stroke-dasharray="3 4"/>` + t(x - 7, row + 4, value, 11, C.muted, 'text-anchor="end"');
  }
  body += `<polygon points="${x},${y + height} ${points.map(p => p.join(',')).join(' ')} ${x + width},${y + height}" fill="#ddedfc"/>`;
  body += `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${C.blue}" stroke-width="2"/>`;
  labels.forEach((label, i) => {
    if (label) body += t(points[i][0], y + height + 20, label, 11, C.muted, 'text-anchor="middle"');
  });
  return body;
}

export async function renderProfile({ config, snapshot: d, imageData, warnings, out }) {
  async function card(name, body, width, height) {
    await sharp(Buffer.from(svg(body, width, height))).png().toFile(`${out}/${name}.png`);
  }
  const art = `data:image/png;base64,${(await fs.readFile('assets/source/forest-with-title.png')).toString('base64')}`;
  await card('header', `<image href="${art}" x="0" y="0" width="146" height="245" preserveAspectRatio="xMidYMid meet"/>`
    + t(184, 76, config.github, 34, C.text, 'font-weight="600"')
    + t(184, 115, config.displayName, 21, C.muted)
    + t(184, 164, config.signature, 22), 1000, 250);

  const owned = d.repos.filter(repo => !repo.fork);
  const s = streaks(d.calendar.days);
  const stars = owned.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const leftWidth = 380, rightWidth = 600;
  let stats = title('GitHub 统计', leftWidth);
  const facts = [`${d.calendar.total} 次贡献（过去一年）`, `${d.github.public_repos} 个公开仓库 · ${stars} 个 Stars`, `加入于 ${d.github.created_at.slice(0, 10)}`, d.github.location];
  facts.forEach((value, i) => { stats += t(12, 77 + i * 28, value, 17); });
  stats += t(12, 210, '贡献日历', 18, C.blue);
  const levels = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const firstDay = new Date(`${d.calendar.days[0].date}T00:00:00Z`).getUTCDay();
  for (const [i, day] of d.calendar.days.entries()) {
    const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    stats += r(12 + Math.floor((i + firstDay) / 7) * 6.7, 228 + row * 12, 5, 9, levels[day.level], 1);
  }
  stats += t(12, 333, `${s.active} 个活跃日 · 当前连续 ${s.current} 天 · 最长连续 ${s.best} 天`, 14, C.muted);
  stats += t(12, 359, `${d.calendar.days[0].date} — ${d.calendar.days.at(-1).date}`, 12, C.muted);
  await card('github-summary', stats, leftWidth, 380);
  stats += t(12, 408, '每月贡献', 18, C.blue);
  const months = new Map();
  for (const day of d.calendar.days) months.set(day.date.slice(0, 7), (months.get(day.date.slice(0, 7)) || 0) + day.count);
  const monthly = [...months].slice(-12);
  stats += chart(monthly.map(([, value]) => value), monthly.map(([date], i) => i % 3 === 0 || i === monthly.length - 1 ? date.slice(2) : ''), 39, 432, 320, 105);
  stats += t(12, 596, '最近 30 天', 18, C.blue);
  const recent = d.calendar.days.slice(-30);
  stats += chart(recent.map(day => day.count), recent.map((day, i) => [0, 7, 14, 21, recent.length - 1].includes(i) ? day.date.slice(5) : ''), 39, 620, 320, 100);
  await card('github', stats, leftWidth, 752);
  await card('activity', t(12, 30, '贡献记录', 21, C.blue) + line(45, leftWidth)
    + t(12, 80, '每月贡献', 18, C.blue)
    + chart(monthly.map(([, value]) => value), monthly.map(([date], i) => i % 3 === 0 || i === monthly.length - 1 ? date.slice(2) : ''), 39, 104, 320, 105)
    + t(12, 270, '最近 30 天', 18, C.blue)
    + chart(recent.map(day => day.count), recent.map((day, i) => [0, 7, 14, 21, recent.length - 1].includes(i) ? day.date.slice(5) : ''), 39, 294, 320, 100), leftWidth, 427);

  const languages = Object.entries(d.languages || {}).sort((a, b) => b[1] - a[1]);
  const languageTotal = languages.reduce((sum, [, bytes]) => sum + bytes, 0);
  const languageColors = { HTML: '#e34c26', Python: '#3572a5', JavaScript: '#f1e05a', CSS: '#563d7c', 'C++': '#f34b7d', Go: '#00add8', TypeScript: '#3178c6' };
  let lang = title('语言', leftWidth);
  let offset = 12;
  for (const [language, bytes] of languages) {
    const width = bytes / languageTotal * (leftWidth - 24);
    lang += r(offset, 66, width, 8, languageColors[language] || '#848d97');
    offset += width;
  }
  languages.slice(0, 6).forEach(([language, bytes], i) => {
    const x = 12 + i % 2 * 180, y = 110 + Math.floor(i / 2) * 27;
    lang += r(x, y - 10, 8, 8, languageColors[language] || '#848d97', 4)
      + t(x + 17, y, language, 14) + t(x + 170, y, `${(bytes / languageTotal * 100).toFixed(1)}%`, 13, C.muted, 'text-anchor="end"');
  });
  if (!languages.length) lang += t(12, 104, '暂无语言数据', 15, C.muted);
  lang += t(12, 195, '自有仓库代码字节占比，不含主页制作仓库', 12, C.muted);
  await card('languages', lang, leftWidth, 217);

  for (const [i, name] of config.projects.entries()) {
    const repo = d.repos.find(item => item.name === name);
    if (!repo) throw new Error(`Project missing: ${name}`);
    let body = t(12, 31, name, 20, C.blue);
    const description = name === 'JLU-' ? '吉林大学软件工程学习经验与资料' : 'Transformer 机器翻译模型';
    body += t(12, 66, description, 16, C.muted);
    body += t(12, 99, `★ ${repo.stargazers_count}    Forks ${repo.forks_count}${repo.language ? `    ${repo.language}` : ''}`, 14, C.muted);
    await card(`project-fallback-${i}`, body, 490, 122);
  }

  const favorites = config.favorites.map(f => {
    const entry = d.games.data.find(game => game.subject_id === f.id);
    if (!entry) throw new Error(`Favorite missing: ${f.title}`);
    return { ...entry, displayTitle: f.title };
  });
  async function shelf(name, label, entries, summary = '') {
    const top = summary ? 91 : 63;
    let body = title(label, rightWidth);
    if (summary) body += t(12, 72, summary, 14, C.muted);
    for (const [i, entry] of entries.entries()) {
      const y = top + i * 114;
      const data = await imageData(entry.subject.images?.large || entry.subject.images?.common);
      if (!data) throw new Error(`Cover unavailable: ${entry.subject.name}`);
      body += `<image href="${data}" x="12" y="${y}" width="66" height="96" preserveAspectRatio="xMidYMid meet"/>`;
      const name = entry.displayTitle || entry.subject.name_cn || entry.subject.name;
      const names = splitText(name, 29);
      names.slice(0, 2).forEach((value, row) => { body += t(91, y + 20 + row * 22, short(value, 45), 17, C.blue); });
      const detailY = y + (names.length > 1 ? 62 : 47);
      const state = entry.subject.type === 2 ? `进度 ${entry.ep_status || 0}${entry.subject.eps ? ` / ${entry.subject.eps}` : ''} 集` : ({ 1: '想玩', 2: '已玩', 3: '在玩', 4: '搁置', 5: '抛弃' }[entry.type]);
      const myScore = entry.rate ? `我的评分 ${entry.rate}` : '未评分';
      body += t(91, detailY, `${entry.subject.date?.slice(0, 4) || ''} · ${state} · ${myScore}`, 13, C.muted);
      body += t(91, detailY + 24, `Bangumi ${entry.subject.score ?? '—'}${entry.subject.rank ? ` · 排名 #${entry.subject.rank}` : ''}`, 13, C.muted);
    }
    if (!entries.length) body += t(12, top + 20, '暂无', 15, C.muted);
    await card(name, body, rightWidth, entries.length ? top + entries.length * 114 : top + 52);
  }
  const playing = d.games.data.filter(game => game.type === 3).slice(0, config.playingLimit);
  const watching = d.anime.data.filter(anime => anime.type === 3).slice(0, config.watchingLimit);
  await shelf('favorites', '喜欢的作品', favorites);
  await shelf('playing', '正在游玩', playing, `${d.games.data.filter(game => game.type === 2).length} 部已玩 · ${playing.length} 部在玩`);
  await shelf('watching', '正在追番', watching, `${d.anime.data.filter(anime => anime.type === 2).length} 部看过 · ${watching.length} 部在看`);

  let covers = title('喜欢的作品', rightWidth);
  for (const [i, entry] of favorites.entries()) {
    const x = 12 + (i % 4) * 146, y = 64 + Math.floor(i / 4) * 210;
    const data = await imageData(entry.subject.images?.large || entry.subject.images?.common);
    covers += `<image href="${data}" x="${x + 10}" y="${y}" width="112" height="154" preserveAspectRatio="xMidYMid meet"/>`
      + t(x + 66, y + 178, entry.displayTitle, 16, C.blue, 'text-anchor="middle"')
      + t(x + 66, y + 199, entry.rate ? `我的评分 ${entry.rate}` : '未评分', 12, C.muted, 'text-anchor="middle"');
  }
  await card('favorites-summary', covers, rightWidth, 488);

  let now = title('正在进行', rightWidth);
  let currentY = 74;
  for (const [label, entries] of [['游玩', playing], ['追番', watching]]) {
    now += t(12, currentY, `${label} · ${entries.length}`, 16, C.blue);
    currentY += 18;
    for (const entry of entries.slice(0, 2)) {
      const data = await imageData(entry.subject.images?.large || entry.subject.images?.common);
      now += `<image href="${data}" x="12" y="${currentY}" width="43" height="62" preserveAspectRatio="xMidYMid meet"/>`;
      const names = splitText(entry.subject.name_cn || entry.subject.name, 29).slice(0, 2);
      names.forEach((value, row) => { now += t(69, currentY + 20 + row * 20, value, 16, C.blue); });
      now += t(69, currentY + (names.length > 1 ? 61 : 47), entry.subject.type === 2 ? `进度 ${entry.ep_status || 0}${entry.subject.eps ? ` / ${entry.subject.eps}` : ''} 集` : entry.rate ? `我的评分 ${entry.rate}` : '未评分', 13, C.muted);
      currentY += 79;
    }
    currentY += 8;
  }
  await card('current-summary', now, rightWidth, currentY);

  let people = title('社区', leftWidth);
  for (const [section, key] of ['followers', 'following'].entries()) {
    const y = 76 + section * 146;
    people += t(12, y, `${key === 'followers' ? '关注者' : '关注'} ${d.github[key]}`, 17, C.blue);
    for (const [i, user] of d[key].slice(0, config.peopleLimit).entries()) {
      const data = await imageData(user.avatar_url);
      const x = 12 + (i % 8) * 45, top = y + 15 + Math.floor(i / 8) * 45;
      if (data) people += `<image href="${data}" x="${x}" y="${top}" width="36" height="36"/>`;
    }
  }
  people += t(12, 384, '最近 Star', 18, C.blue);
  let y = 420;
  for (const repo of d.starred) {
    people += t(12, y, short(repo.full_name, 43), 16, C.blue);
    const description = splitText(repo.description, 25).slice(0, 2);
    description.forEach((value, i) => { people += t(12, y + 25 + i * 20, value, 13, C.muted); });
    people += t(12, y + 32 + description.length * 20, `${repo.language || ''}    ★ ${repo.stargazers_count}    Forks ${repo.forks_count}`, 13, C.muted);
    y += 65 + description.length * 20;
  }
  await card('community', people, leftWidth, y + 10);

  let characters = title('收藏角色');
  for (const [i, character] of d.characters.entries()) {
    const data = await imageData(character.image);
    const x = 12 + i % 6 * 78, y = 63 + Math.floor(i / 6) * 117;
    if (data) characters += `<image href="${data}" x="${x}" y="${y}" width="60" height="82" preserveAspectRatio="xMidYMid meet"/>`;
    characters += t(x, y + 103, short(character.name, 6), 11);
  }
  if (!d.characters.length) characters += t(12, 83, '暂无收藏', 15, C.muted);
  await card('characters', characters, 490, d.characters.length ? 68 + Math.ceil(d.characters.length / 6) * 117 : 104);

  const raw = `https://raw.githubusercontent.com/${config.repository}/main`;
  const version = `?v=${config.assetVersion || 1}-${d.fetchedAt}`;
  const image = (name, alt) => `<p><img src="${raw}/${out}/${name}.png${version}" width="100%" alt="${alt}"></p>`;
  const pin = async i => await fs.access(`${out}/project-${i}.svg`).then(() => `${raw}/${out}/project-${i}.svg${version}`).catch(() => `${raw}/${out}/project-fallback-${i}.png${version}`);
  const link = (label, url) => `<a href="${escape(url)}">${escape(label)}</a>`;
  const metrics = await fs.access(`${out}/metrics.svg`).then(() => `<details><summary>详细统计</summary><p><img src="${raw}/${out}/metrics.svg" width="100%" alt="详细 GitHub 统计"></p></details>`).catch(() => '');
  const projectImages = (await Promise.all(config.projects.map(async (name, i) => `<p><a href="https://github.com/${config.github}/${escape(name)}"><img src="${await pin(i)}" width="100%" alt="${escape(name)}"></a></p>`))).join('\n');
  const collections = collectionDetails(config, d);
  const coverPaths = new Map();
  for (const entry of Object.values(collections).flat()) {
    const url = entry.subject.images?.large || entry.subject.images?.common;
    if (await imageData(url)) {
      const hash = crypto.createHash('sha256').update(url.startsWith('//') ? `https:${url}` : url).digest('hex').slice(0, 20);
      coverPaths.set(entry.subject_id, `${raw}/assets/source/media/${hash}.png${version}`);
    }
  }
  const cover = entry => coverPaths.has(entry.subject_id) ? `<a href="https://bangumi.tv/subject/${entry.subject_id}"><img src="${coverPaths.get(entry.subject_id)}" width="48" alt="${escape(entry.subject.name_cn || entry.subject.name)}"></a>` : '';
  const readme = composeReadme({ config, snapshot: d, image, link, projectImages, metrics, collections, cover });
  await fs.writeFile('README.md', readme);
  const preview = new MarkdownIt({ html: true }).render(readme).replaceAll(`${raw}/`, './');
  await fs.writeFile('preview.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>sorastyx · README</title><style>body{margin:0;background:#fff;color:#1f2328;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}.bar{padding:16px 30px;background:#f6f8fa;border-bottom:1px solid #d1d9e0;font-size:14px}.bar b{color:#0969da}.readme{max-width:960px;margin:24px auto;padding:28px;border:1px solid #d1d9e0;border-radius:6px;line-height:1.5}.readme img{max-width:100%;height:auto;vertical-align:middle}.readme p{margin:12px 0}.readme h3{font-size:19px;margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid #d1d9e0}table{border-collapse:collapse;width:100%;table-layout:fixed}td{padding:10px;border:1px solid #d1d9e0;vertical-align:top}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}summary{cursor:pointer}@media(max-width:600px){.readme{margin:6px;padding:10px}.bar{padding:12px}td{padding:4px}}</style><div class="bar"><b>${escape(config.repository)}</b> · README.md</div><main class="readme">${preview}</main></html>`);
  await fs.writeFile('data/build-report.json', JSON.stringify({ date: d.fetchedAt, sources: d.sources, favorites: favorites.length, playing: playing.length, watching: watching.length, characters: d.characters.length, collectionRecords: Object.fromEntries(Object.entries(collections).map(([key, entries]) => [key, entries.length])), warnings }, null, 2) + '\n');
}
