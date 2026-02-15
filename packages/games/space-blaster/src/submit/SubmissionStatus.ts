export type SubmissionStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
<<<<<<< HEAD
  | {
      state: 'success';
      submittedAtMs?: number;
      rank?: number;
      personalBest?: boolean;
      bestScore?: number;
    }
=======
  | { state: 'success'; submittedAtMs?: number }
>>>>>>> c46f2e7 (Task 38.2 - Wire sdk.submitScore with non-blocking flow + status)
  | { state: 'skipped'; reason: 'unauthenticated' | 'missingRunId' }
  | { state: 'fail'; errorMessage: string };
