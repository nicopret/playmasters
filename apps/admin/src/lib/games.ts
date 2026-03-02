const GAME_DISPLAY_NAMES: Record<string, string> = {
  'space-blaster': 'Space Blaster',
};

const toTitleCaseWords = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function getGameDisplayName(gameId: string): string {
  const normalizedGameId = gameId.trim().toLowerCase();
  if (!normalizedGameId) return 'Game';

  return (
    GAME_DISPLAY_NAMES[normalizedGameId] ?? toTitleCaseWords(normalizedGameId)
  );
}
