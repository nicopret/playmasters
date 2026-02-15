# Space Blaster Results Overlay Test Plan (Ticket #38)

## Scope

- Verify results overlay fields are populated from finalized score state and run context.
- Verify submission outcome messaging and optional leaderboard feedback rendering.

## Manual Verification

1. Unauthenticated flow

- Start a run while not authenticated.
- Finish the run and reach `RESULTS`.
- Confirm overlay shows: final score, level reached, wave reached, accuracy, max combo, wave bonuses.
- Confirm submission section shows `Skipped` and no rank/personal-best section.

2. Authenticated success flow

- Start a run while authenticated with a valid `runId`.
- Finish the run and reach `RESULTS`.
- Confirm submission section shows `Success`.
- If SDK response includes leaderboard metadata, confirm rank/personal-best lines appear.

3. Authenticated failure flow

- Mock/force `sdk.submitScore` to reject.
- Finish the run and reach `RESULTS`.
- Confirm submission section shows `Failed` with an error message.
- Confirm run still reaches and stays in `RESULTS` (non-blocking submission).

## Automated Coverage

- `src/results/buildResultsViewModel.spec.ts`
  - score composition mapping (score, level/wave, accuracy, max combo, wave bonuses)
  - skipped/failed submission rendering values
  - optional rank/personal-best rendering when metadata exists
- `src/submit/buildSubmitScorePayload.test.ts`
  - stable payload shape, unauth run support, hidden field exclusion (#160)
- `src/runtime/run-submission.spec.ts`
  - once-per-run submit behavior, skipped/fail states (#161)
