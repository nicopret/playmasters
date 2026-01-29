export type EmbeddedGame = {
  mount: (opts: {
    el: HTMLElement;
    sdk: import('@playmasters/game-sdk').GameSdk;
    onReady?: () => void;
    onGameOver?: (finalScore: number) => void;
  }) => { destroy: () => void };
};
