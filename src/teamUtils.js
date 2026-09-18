function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isDukeTeam(team) {
  const slug = normalized(team?.slug);
  const name = normalized(team?.name);
  return slug === 'duke' || slug.startsWith('duke') || name === 'duke' || name.startsWith('duke');
}
