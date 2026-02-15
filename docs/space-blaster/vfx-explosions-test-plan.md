# Space Blaster VFX Explosions Test Plan (Ticket #42)

## Scope

- Pooled explosion visuals with automatic release.
- Bounded particle behavior under stress.
- Visual fairness: bullets remain visible through effects.

## Manual Verification

1. Stress burst test

- Spawn/kill many enemies quickly.
- Confirm no runaway memory/perf behavior.
- Check `vfx.getDebugStats()` in dev hooks if available:
  - active counts should rise/fall, not grow unbounded.

2. Bullet visibility fairness

- Fire continuously through enemy deaths/explosions.
- Confirm projectiles remain visible above VFX (depth ordering).
- Confirm effects are short-lived and low-alpha.

3. Pool reuse behavior

- Trigger repeated explosion bursts over multiple waves.
- Confirm active explosion count returns to near zero between bursts.
- Confirm no orphaned visual objects after run restart/scene destroy.

4. Freeze/resume timing

- Trigger explosion, then freeze simulation (non-PLAYING/overlay-blocked).
- Confirm effect timing pauses while frozen.
- Resume simulation and confirm expiry continues from paused point.
