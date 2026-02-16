# Space Blaster Pooling Spec (Ticket #190)

## Purpose

Space Blaster uses bounded object pools to avoid runtime allocation spikes and uncontrolled memory growth during heavy combat.

## Canonical API

All gameplay pools should use a single API shape:

- `acquire(): T | null`
- `release(obj: T): void`
- `resetAll(): void`

Implementation: `packages/games/space-blaster/src/perf/ObjectPool.ts`.

## Pool Targets

### Player bullets

- Object type: `Phaser.GameObjects.Rectangle` projectiles in `WeaponSystem`
- Limits: `initial=32`, `max=128`
- At cap behavior: `tryFire()` returns `false` (shot not spawned)
- Reset behavior: `resetAll()` disables physics body, hides projectile, moves offscreen

### Enemy bullets

- Object type: `Phaser.GameObjects.Rectangle` projectiles in `WeaponSystem`
- Limits: `initial=32`, `max=128`
- At cap behavior: enemy fire spawn is skipped when no pooled object is available
- Reset behavior: same as player bullets

### Explosions

- Object type: `Phaser.GameObjects.Arc` in `VfxSystem`
- Limits: `initial=16`, `max=64`
- At cap behavior: explosion spawn is dropped for that event
- Reset behavior: hide, deactivate, move offscreen

### Particles

- Object type: `Phaser.GameObjects.Arc` particle sprites in `VfxSystem`
- Limits: `initial=8`, `max=32`
- At cap behavior: particle burst degrades (spawns fewer or none) while explosion still renders
- Reset behavior: hide, deactivate, move offscreen

### Enemies (v1)

- Status: **not pooled in v1**
- Rationale: formation lifecycle/state/slot ownership currently destroys and respawns cleanly per wave; pooling enemies would add complexity around controller/state teardown and slot reservations. Revisit after profiling indicates enemy allocation pressure.

## Source of Truth for Limits

Code constants live in:

- `packages/games/space-blaster/src/perf/poolLimits.ts`

## Global Rules

- Pools are hard-capped; no unbounded growth.
- Pooled objects must be fully reset on release (position, visibility, activity, physics/listeners as applicable).
- Pools are reset on run/session cleanup via system clear/destroy paths.
- Layering fairness: bullets render above explosions/particles.
