import { createInitialScoreState } from '../scoring';
import type { FinalScoreSummary } from '../scoring';
import { buildResultsViewModel } from './buildResultsViewModel';

const summary: FinalScoreSummary = {
  score: 3210,
  durationMs: 9999,
  levelReached: 3,
  waveReached: 4,
  stats: {
    shotsFired: 10,
    shotsHit: 7,
    kills: 15,
    wavesCleared: 3,
  },
};

describe('buildResultsViewModel', () => {
  it('maps score composition fields for results overlay', () => {
    const state = createInitialScoreState();
    state.maxComboCount = 5;
    state.breakdownTotals.waveClearBonuses = 250;

    const model = buildResultsViewModel({
      finalScore: summary,
      scoreState: state,
      submissionStatus: { state: 'success' },
    });

    expect(model.finalScore).toBe(3210);
    expect(model.levelReached).toBe(3);
    expect(model.waveReached).toBe(4);
    expect(model.accuracyPercent).toBe(70);
    expect(model.maxCombo).toBe(5);
    expect(model.waveBonuses).toBe(250);
    expect(model.submissionStatusLabel).toBe('Submission: Success');
  });

  it('handles skipped and failed status with details', () => {
    const state = createInitialScoreState();
    const skipped = buildResultsViewModel({
      finalScore: summary,
      scoreState: state,
      submissionStatus: { state: 'skipped', reason: 'unauthenticated' },
    });
    const failed = buildResultsViewModel({
      finalScore: summary,
      scoreState: state,
      submissionStatus: { state: 'fail', errorMessage: 'network down' },
    });

    expect(skipped.submissionStatusLabel).toBe('Submission: Skipped');
    expect(skipped.submissionStatusDetail).toBe('Not signed in');
    expect(failed.submissionStatusLabel).toBe('Submission: Failed');
    expect(failed.submissionStatusDetail).toBe('network down');
  });

  it('shows rank and personal best when available', () => {
    const state = createInitialScoreState();
    const model = buildResultsViewModel({
      finalScore: summary,
      scoreState: state,
      submissionStatus: {
        state: 'success',
        rank: 12,
        personalBest: true,
      },
    });

    expect(model.rankLabel).toBe('Rank: #12');
    expect(model.personalBestLabel).toBe('New personal best!');
  });
});
