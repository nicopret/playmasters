import type { EmbeddedGameSdk } from '@playmasters/types';
import { createRunContext } from './run-context';
import { registerRunIfAuthenticated } from './run-registration';
import { buildRunScoreSubmissionPayload } from './run-submission';

const resolvedConfigExample = {
  configHash: 'f'.repeat(64),
  versionHash: 'e'.repeat(64),
  gameConfig: { defaultLives: 3 },
  levelConfigs: [
    {
      layoutId: 'layout-a',
      enemyTypes: ['enemy-a'],
      waves: [{ enemyId: 'enemy-a', count: 1 }],
    },
  ],
  heroCatalog: { entries: [{ heroId: 'hero-a', defaultAmmoId: 'ammo-a' }] },
  enemyCatalog: { entries: [{ enemyId: 'enemy-a' }] },
  ammoCatalog: { entries: [{ ammoId: 'ammo-a' }] },
  formationLayouts: { entries: [{ layoutId: 'layout-a' }] },
  scoreConfig: { baseEnemyScores: [{ enemyId: 'enemy-a', score: 100 }] },
};

const createSdkMock = (): EmbeddedGameSdk => ({
  isAuthenticated: true,
  startRun: jest.fn(async () => ({
    run: { runId: 'run-123', startedAt: '2026-02-16T00:00:00.000Z' },
    sessionToken: 'token-123',
  })),
  submitScore: jest.fn(async () => undefined),
});

describe('buildRunScoreSubmissionPayload', () => {
  it('uses the hash captured at run start', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);

    const payload = buildRunScoreSubmissionPayload(ctx, 1234, 4567);
    expect(payload).toEqual({
      score: 1234,
      durationMs: 4567,
      configHash: resolvedConfigExample.configHash,
      versionHash: resolvedConfigExample.versionHash,
    });
  });

  it('does not drift if active config hash changes after run start', async () => {
    const ctx = createRunContext({
      sdk: createSdkMock(),
      resolvedConfig: resolvedConfigExample,
    });
    await registerRunIfAuthenticated(ctx);
    const captured = ctx.runConfigHash;
    (ctx as unknown as { configHash: string }).configHash = '0'.repeat(64);

    const payload = buildRunScoreSubmissionPayload(ctx, 99);
    expect(payload.configHash).toBe(captured);
  });
});
