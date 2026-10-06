export function composeReadme({ config, snapshot, image, link, projectImages, metrics, collections, cover }) {
  const github = `https://github.com/${config.github}`;
  const bangumi = `https://bangumi.tv/user/${config.bangumi}`;
  const totals = items => [1, 2, 3, 4, 5].map(type => items.filter(item => item.type === type).length);
  const [gamePlan, gameDone, gameCurrent, gameHold, gameDrop] = totals(snapshot.games.data);
  const [animePlan, animeDone, animeCurrent, animeHold, animeDrop] = totals(snapshot.anime.data);
  const overview = `<h3>收藏概况</h3>
<p>游戏：${gameDone} 已玩 · ${gameCurrent} 在玩 · ${gamePlan} 想玩${gameHold ? ` · ${gameHold} 搁置` : ''}${gameDrop ? ` · ${gameDrop} 抛弃` : ''}<br>
动画：${animeDone} 看过 · ${animeCurrent} 在看 · ${animePlan} 想看${animeHold ? ` · ${animeHold} 搁置` : ''}${animeDrop ? ` · ${animeDrop} 抛弃` : ''}</p>`;
  const shelf = (heading, entries, completed = false) => entries.length ? `<h3>${heading}</h3>
<table>
${entries.map(entry => {
    const url = `https://bangumi.tv/subject/${entry.subject_id}`;
    const name = entry.subject.name_cn || entry.subject.name;
    const year = entry.subject.date?.slice(0, 4);
    const score = entry.rate ? `我的评分 ${entry.rate}` : '未评分';
    return `<tr><td width="64">${cover(entry)}</td><td>${link(name, url)}<br><sub>${[year, completed ? score : null].filter(Boolean).join(' · ')}</sub></td></tr>`;
  }).join('\n')}
</table>` : '';
  const records = `${overview}
${shelf('已玩', collections.played, true)}
${shelf('看过', collections.watched, true)}
<details>
<summary>想玩／想看</summary>

${shelf('想玩', collections.wantPlay)}
${shelf('想看', collections.wantWatch)}

</details>`;
  const table = (left, right) => `<table>
<tr>
<td width="38%" valign="top">
${left}
</td>
<td width="62%" valign="top">
${right}
</td>
</tr>
</table>`;
  return `${image('header', `${config.github} · ${config.displayName} · Forest`)}
<p>${link('GitHub', github)} · ${link('Bangumi', bangumi)}</p>

${table(
    `${image('github-summary', 'GitHub 统计和年度贡献日历')}
${image('languages', '仓库语言分布')}
<h3>项目</h3>
${projectImages}`,
    `${image('favorites-summary', '喜欢的作品：樱之诗、樱之刻、I/O、Ever17、素晴日、命运石之门、Forest')}
${image('current-summary', '正在游玩和追番的作品概览')}
<p>${link('全部收藏', bangumi)}</p>`
  )}

<details>
<summary>更多</summary>

${table(
    `${image('activity', '每月贡献和最近 30 天贡献曲线')}
${image('community', '关注者、关注列表和最近 Star 的仓库')}
<p>${link('关注者', `${github}?tab=followers`)} · ${link('关注', `${github}?tab=following`)} · ${link('Stars', `${github}?tab=stars`)}</p>`,
    `${records}
${snapshot.characters.length ? image('characters', '收藏的角色') : ''}
<p>${link('Bangumi 收藏', bangumi)} · ${link('收藏角色', `https://bgm.tv/user/${config.bangumi}/mono/character`)}</p>`
  )}
${metrics}

</details>

<p><img src="https://count.getloli.com/@sorastyx-profile?name=sorastyx-profile&amp;theme=${config.counterTheme}&amp;padding=7&amp;offset=0&amp;align=top&amp;scale=1&amp;pixelated=1&amp;darkmode=auto" width="65%" alt="访问次数"></p>
`;
}
