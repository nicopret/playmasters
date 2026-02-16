# Space Blaster Pooling Spec (Ticket #190)

## Purpose

Space Blaster uses bounded object pools to avoid runtime allocation spikes and unbounded memory growth during heavy combat.

## Canonical API

All gameplay pools should use one API:

- `acquire(): T | null`
- `release(item: T): void`
- `resetAll(): void`
- `stats(): { free: number; active: number; total: number; max: number }`

Implementation: `packages/games/space-blaster/src/perf/ObjectPool.ts`

## Pool Targets

- Player bullets
- Enemy bullets
- Explosions
- Particles
- Enemies (not pooled in v1)

## Limits and Caps

Source of truth: `packages/games/space-blaster/src/perf/poolLimits.ts`

- Player bullets: initial `128`, max `128`
- Enemy bullets: initial `128`, max `128`
- Explosions: initial `16`, max `64`
- Particles: initial `8`, max `32`

## Cap Behavior

- Bullet pools use **skip spawn** on exhaustion (no allocation past cap).
- VFX pools drop extra effects when exhausted.

## Reset Rules

On release, pooled projectiles reset:

- physics velocity/body enabled flag
- active/visible flags
- position offscreen
- alpha/scale/rotation defaults

## Enemies in v1

Enemies are not pooled in v1 to keep formation-slot and controller state transitions deterministic.

## Global Rules

- Pools are hard-capped; no unbounded growth.
- Pooled objects must be fully reset on release.
- Pools are reset on run/session cleanup via clear/destroy paths.
- Layering fairness: bullets render above explosions/particles.
