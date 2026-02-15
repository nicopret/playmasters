# Space Blaster Banner Queue Test Plan (Ticket #41)

## Scope

- Verify transient banners queue sequentially without overlap.
- Verify banner placement remains in safe HUD top zone.
- Verify expiration is driven by simulation clock.

## Manual Verification

1. Sequential queue behavior

- Trigger tier-up and wave-clear events in quick succession.
- Confirm only one banner is visible at a time.
- Confirm banners display in order (tier first, then wave clear).

2. Safe-zone positioning

- During active gameplay, confirm the banner is anchored in the top HUD band.
- Confirm it does not cover enemy/player critical play area.

3. Sim-clock timing / pause behavior

- Trigger a banner, then freeze simulation (overlay/state freeze).
- Confirm banner remains visible while frozen (no expiry).
- Resume simulation and confirm banner expiry resumes from the paused point.

## Automated Coverage

- `src/ui/BannerQueue.test.ts`
  - sequential playback
  - no overlap (single active)
  - frozen nowMs does not expire
  - bounded queue capacity
- `src/ui/HUDSystem.spec.ts`
  - event-driven enqueue + sequential display
  - combo reset hides tier banner
