export type SubmissionStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | {
      state: 'success';
      submittedAtMs?: number;
      rank?: number;
      personalBest?: boolean;
      bestScore?: number;
    }
  | { state: 'skipped'; reason: 'unauthenticated' | 'missingRunId' }
  | { state: 'fail'; errorMessage: string };
