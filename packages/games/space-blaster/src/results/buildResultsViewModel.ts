import type { FinalScoreSummary } from '../scoring';
import type { ScoreState } from '../scoring';
import type { SubmissionStatus } from '../submit';

export type ResultsViewModel = {
  finalScore: number;
  levelReached: number;
  waveReached: number;
  accuracyPercent: number;
  maxCombo: number;
  waveBonuses: number;
  submissionStatusLabel: string;
  submissionStatusDetail?: string;
  rankLabel?: string;
  personalBestLabel?: string;
};

const toNonNegativeInt = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const computeAccuracyPercent = (
  shotsFired: number,
  shotsHit: number,
): number => {
  const raw = shotsHit / Math.max(1, shotsFired);
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
};

const describeSubmissionStatus = (
  status: SubmissionStatus | undefined,
): Pick<
  ResultsViewModel,
  | 'submissionStatusLabel'
  | 'submissionStatusDetail'
  | 'rankLabel'
  | 'personalBestLabel'
> => {
  if (!status || status.state === 'idle') {
    return { submissionStatusLabel: 'Submission: Not attempted' };
  }
  if (status.state === 'submitting') {
    return { submissionStatusLabel: 'Submission: In progress' };
  }
  if (status.state === 'skipped') {
    return {
      submissionStatusLabel: 'Submission: Skipped',
      submissionStatusDetail:
        status.reason === 'missingRunId' ? 'Missing run id' : 'Not signed in',
    };
  }
  if (status.state === 'fail') {
    return {
      submissionStatusLabel: 'Submission: Failed',
      submissionStatusDetail: status.errorMessage,
    };
  }

  return {
    submissionStatusLabel: 'Submission: Success',
    rankLabel:
      typeof status.rank === 'number' ? `Rank: #${status.rank}` : undefined,
    personalBestLabel:
      status.personalBest === true
        ? 'New personal best!'
        : typeof status.bestScore === 'number'
          ? `Personal best: ${status.bestScore}`
          : undefined,
  };
};

export const buildResultsViewModel = (args: {
  finalScore: FinalScoreSummary;
  scoreState: Readonly<ScoreState>;
  submissionStatus?: SubmissionStatus;
}): ResultsViewModel => {
  const finalScore = toNonNegativeInt(args.finalScore.score);
  const levelReached = Math.max(
    1,
    toNonNegativeInt(args.finalScore.levelReached),
  );
  const waveReached = Math.max(
    1,
    toNonNegativeInt(args.finalScore.waveReached),
  );
  const accuracyPercent = computeAccuracyPercent(
    toNonNegativeInt(args.finalScore.stats.shotsFired),
    toNonNegativeInt(args.finalScore.stats.shotsHit),
  );
  const maxCombo = toNonNegativeInt(args.scoreState.maxComboCount);
  const waveBonuses = toNonNegativeInt(
    args.scoreState.breakdownTotals.waveClearBonuses,
  );
  return {
    finalScore,
    levelReached,
    waveReached,
    accuracyPercent,
    maxCombo,
    waveBonuses,
    ...describeSubmissionStatus(args.submissionStatus),
  };
};
