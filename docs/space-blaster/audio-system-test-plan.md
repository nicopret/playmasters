# Space Blaster Audio System Test Plan (Ticket #43)

## Scope

- Music/SFX routing and event-driven hooks.
- Dive telegraph SFX timing.
- Pause overlay behavior (`pause`/`mute`/`duck`) from config.

## Manual Verification

1. Run start

- Start a run and verify music starts if configured/enabled.

2. Gameplay SFX hooks

- Fire shot: fire SFX.
- Player hit: hit SFX.
- Enemy kill: kill SFX.
- Combo tier-up: tier-up SFX.
- Wave clear: wave-clear SFX plays once per wave.
- Game over / run ending: game-over SFX.

3. Dive telegraph

- Trigger dive scheduling with telegraph lead enabled.
- Confirm dive telegraph SFX is heard before the dive starts.

4. Pause overlay behavior

- Set config `audio.pauseBehavior.mode` to `pause`, verify sounds pause/resume.
- Set mode `mute`, verify volumes go to zero and restore.
- Set mode `duck`, verify music lowers by duck factor and restores.

5. Mount/unmount safety

- Mount/unmount repeatedly.
- Verify no lingering music, no duplicated SFX listeners, and no crashes if keys are missing.

## Automated Coverage

- `src/audio/audio-routing.spec.ts`
  - event-to-sfx key mapping
  - pause mode volume routing (`pause`, `mute`, `duck`)
- `src/enemies/DiveScheduler.spec.ts`
  - telegraph emitted before dive start when lead time configured
