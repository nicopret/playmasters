# Space Blaster Settings Overlay Test Plan (Ticket #44)

## Scope

- Pause overlay settings panel with independent music/SFX volume sliders.
- Session persistence within a single mounted game session.
- Safe pause-state behavior when entering and closing settings.

## Manual Verification

1. Open settings from pause

- Start a run and press `Esc`.
- Confirm pause menu appears.
- Click `Settings`.
- Confirm settings panel is visible and gameplay remains paused.

2. Independent channel control

- Move **Music Volume** slider and verify background music volume changes immediately.
- Confirm SFX loudness is unchanged.
- Move **SFX Volume** slider and trigger shots/hits.
- Confirm SFX volume changes immediately while music level is unchanged.

3. Close behavior safety

- Press `Esc` while settings panel is open.
- Confirm it returns to paused menu (not gameplay).
- Press `Esc` again (or click `Resume`) and confirm gameplay resumes.

4. Session persistence

- During the same mount session, set custom music/SFX volumes.
- Finish run and start a new run via replay flow.
- Confirm music/SFX volumes remain at the chosen values.

5. Remount behavior

- Unmount and remount the game.
- Confirm session settings reset to config/default values.

6. Leak/glitch checks

- Open/close pause/settings overlay repeatedly (10+ times).
- Confirm no duplicate input behavior, no listener buildup symptoms, and no stacked music instances.
