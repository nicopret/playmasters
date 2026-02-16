# Space Blaster Projectile Pooling Test Plan (Ticket #191)

## Scope

- Player and enemy bullet pools are capped and reused.
- Bullet state reset on release/reacquire.
- Exhaustion strategy degrades safely by skipping spawn.

## Manual Verification

1. Player bullet spam

- Start a run and hold fire for 30 seconds.
- Confirm no runaway memory growth and no stutter spikes.
- Confirm bullets recycle after leaving screen and after hits.

2. Enemy bullet spam

- Use a high-fire wave and observe sustained enemy fire.
- Confirm bullet counts remain stable and no crash occurs.

3. Reset correctness

- Observe reused bullets for stale state issues (rotation/alpha/scale/velocity).
- Confirm collision works after repeated reuse.

4. Exhaustion behavior

- Temporarily reduce bullet caps in `poolLimits.ts` to `4`.
- Hold fire and confirm extra shots are skipped (no allocations, no crash).

## Automated Coverage

- `src/projectiles/ProjectilePool.spec.ts`
- `src/systems/WeaponSystem.pooling.spec.ts`
- `src/perf/ObjectPool.test.ts`
