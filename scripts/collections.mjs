export function collectionDetails(config, snapshot) {
  const favoriteIds = new Set([...config.favorites.map(item => item.id), ...(config.detailExcludedSubjects || [])]);
  const recent = (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  const completed = (items, limit) => items.filter(item => item.type === 2 && !favoriteIds.has(item.subject_id))
    .sort((a, b) => (b.rate || 0) - (a.rate || 0) || recent(a, b)).slice(0, limit);
  const planned = (items, limit) => items.filter(item => item.type === 1 && !favoriteIds.has(item.subject_id))
    .sort(recent).slice(0, limit);
  return {
    played: completed(snapshot.games.data, config.completedGameLimit || 6),
    watched: completed(snapshot.anime.data, config.completedAnimeLimit || 5),
    wantPlay: planned(snapshot.games.data, config.plannedGameLimit || 6),
    wantWatch: planned(snapshot.anime.data, config.plannedAnimeLimit || 4),
  };
}
