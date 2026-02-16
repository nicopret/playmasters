# Space Blaster VFX Pooling Test Plan (Ticket #192)

## Goals

- Explosions are pooled and released automatically.
- Particle budgets are capped and enforced.
- No memory growth across repeated waves and restarts.

## Manual Verification

1. Wave loop stability

- Play through several waves and observe repeated enemy kills.
- Confirm explosions appear and then disappear; no stuck effects remain.

2. Restart resilience

- Restart the run at least 10 times.
- Confirm no duplicate VFX artifacts and no visible buildup of stale effects.

3. Stress kill scenario

- Create a high kill-rate scenario and clear enemies rapidly.
- Confirm particle intensity degrades under load (fewer particles) instead of escalating unbounded.

4. Fairness/legibility check

- Fire continuously during heavy VFX.
- Confirm bullets remain readable above effects (VFX rendered below bullet depth).

5. Shutdown cleanup

- Unmount/remount the game.
- Confirm no lingering VFX objects or listeners from previous mount.

## Optional Debug Checks

Use VFX debug stats during stress runs:

- `activeExplosions`
- `activeParticles`
- `freeExplosions`
- `freeParticles`
- `particleInUse`
- `activeBursts`

Expected behavior: values fluctuate within caps and return toward baseline when action quiets.
