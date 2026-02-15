export type SubmissionStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; submittedAtMs?: number }
  | { state: 'skipped'; reason: 'unauthenticated' | 'missingRunId' }
  | { state: 'fail'; errorMessage: string };
