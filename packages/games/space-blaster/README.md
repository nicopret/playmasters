# Space Blaster Package

## Entrypoint

Public exports from `@playmasters/space-blaster`:

- `mount(container, { sdk, resolvedConfig, onReady?, onGameOver? })`
- `unmount(handle)`
- `spaceBlaster` (legacy EmbeddedGame shape for host compatibility)

`resolvedConfig` is captured into run context at mount-time and stays frozen for that run.

## Mount / unmount usage

```ts
import { mount, unmount } from '@playmasters/space-blaster';

const handle = mount(container, {
  sdk,
  resolvedConfig,
  onReady: () => console.log('READY'),
});

// later
unmount(handle);
```

`unmount` is idempotent and performs:

- Phaser destroy
- timer cleanup
- scene input listener cleanup
- audio stop/remove
- container DOM cleanup (canvas residue removed)

## Smoke harness

Use the host harness route:

- `/dev/space-blaster-smoke`

The harness supports Mount, Unmount, and `Run 10 cycles`, and reports:

- active canvas count
- active disposable count
- optional heap sample trend

Pass expectation:

- each cycle returns to zero canvas and zero active disposables after unmount
- READY is reached on mount
