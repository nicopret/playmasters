# Space Blaster Pool Metrics Dev Test Plan (Ticket #193)

## Goals

- Dev-only pool metrics overlay shows active/free/total/max counters.
- Restart/new-run returns pools to baseline with no stranded actives.

## Steps

1. Dev overlay visibility

- Run Space Blaster in a non-production build.
- Verify a `[DEV] Pool Metrics` panel appears in the top-left HUD area.

2. Counter behavior during play

- Fire player bullets and trigger enemy firing.
- Confirm bullet pool active counts rise and return as projectiles despawn.
- Kill enemies and confirm explosion/particle counters increase then return down.

3. Restart baseline reset

- Restart the run.
- Confirm pool actives return to baseline values (`active=0`, particles `inUse=0`, `activeBursts=0`).
- Confirm no `[LEAK]` line appears when baseline is restored.

4. Repeated restart loop

- Repeat restart at least 10 times.
- Confirm counters remain stable and baseline checks stay clean.
