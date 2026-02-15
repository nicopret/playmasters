export type SubmissionStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 4eaccd8 (Results screen - score breakdown + submissions status + leaderboard view)
  | {
      state: 'success';
      submittedAtMs?: number;
      rank?: number;
      personalBest?: boolean;
      bestScore?: number;
    }
<<<<<<< HEAD
=======
  | { state: 'success'; submittedAtMs?: number }
>>>>>>> c46f2e7 (Task 38.2 - Wire sdk.submitScore with non-blocking flow + status)
=======
>>>>>>> 4eaccd8 (Results screen - score breakdown + submissions status + leaderboard view)
  | { state: 'skipped'; reason: 'unauthenticated' | 'missingRunId' }
  | { state: 'fail'; errorMessage: string };
