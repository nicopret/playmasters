# Space Blaster HUDSystem Test Plan (Ticket #40)

## Scope

- Reactive HUD updates for score, lives, and combo tier banner.
- Verify behavior across run start, gameplay, combo breaks, and restart.

## Manual Verification

1. Score immediacy

- Start a run and kill an enemy.
- Confirm score text updates in the same gameplay beat as the kill (no delayed jump).

2. Lives updates

- Take a hit while in `PLAYING`.
- Confirm lives text decrements immediately.
- Verify no extra decrement during invulnerability/respawn lockout.

3. Tier banner show/hide

- Build combo until a tier-up event occurs.
- Confirm banner appears immediately on tier-up.
- Stop chaining kills until combo breaks (or get hit when combo reset-on-hit is enabled).
- Confirm banner hides on combo break.
- Confirm banner also auto-hides after the configured duration.

4. Run restart reset

- Finish a run and restart.
- Confirm score/lives HUD resets to the new run baseline.

## Automated Coverage

- `src/ui/HUDSystem.spec.ts`
  - reacts to `score.changed` immediately
  - reacts to `player.livesChanged` immediately
  - shows tier banner on `score.tierEntered`
  - hides banner on `score.comboReset`
- `src/scoring/ScoreSystem.spec.ts`
  - tracks `maxComboCount` for HUD display
