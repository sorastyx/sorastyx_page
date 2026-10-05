export function composeReadme({ config, snapshot, image, link, projectImages, metrics }) {
  const github = `https://github.com/${config.github}`;
  const bangumi = `https://bangumi.tv/user/${config.bangumi}`;
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
    `${image('favorites', '喜欢的作品评分和收藏状态')}
${image('playing', '正在游玩的游戏完整列表')}
${image('watching', '正在追的动画完整列表')}
${snapshot.characters.length ? image('characters', '收藏的角色') : ''}
<p>${link('Bangumi 收藏', bangumi)} · ${link('收藏角色', `https://bgm.tv/user/${config.bangumi}/mono/character`)}</p>`
  )}
${metrics}

</details>

<p><img src="https://count.getloli.com/@sorastyx-profile?name=sorastyx-profile&amp;theme=${config.counterTheme}&amp;padding=7&amp;offset=0&amp;align=top&amp;scale=1&amp;pixelated=1&amp;darkmode=auto" width="65%" alt="访问次数"></p>
`;
}
