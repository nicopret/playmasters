'use client';

import { useMemo, useRef, useState } from 'react';
import {
  resolvedConfigExample,
  type EmbeddedGameSdk,
} from '@playmasters/types';
import type { SpaceBlasterMountHandle } from '@playmasters/space-blaster';

type CycleSample = {
  cycle: number;
  activeCanvasCount: number;
  activeDisposables: number;
  heapUsedMb?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createSdkMock = (): EmbeddedGameSdk => ({
  startRun: async () => ({
    run: { runId: 'smoke-run', startedAt: new Date().toISOString() },
    sessionToken: 'smoke-token',
  }),
  submitScore: async () => undefined,
});

export default function SpaceBlasterSmokePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<SpaceBlasterMountHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<CycleSample[]>([]);
  const sdk = useMemo(() => createSdkMock(), []);

  const mountGame = async () => {
    if (!containerRef.current || handleRef.current) return;
    const module = await import('@playmasters/space-blaster');
    setReady(false);
    handleRef.current = module.mount(containerRef.current, {
      sdk,
      resolvedConfig: resolvedConfigExample,
      onReady: () => setReady(true),
    });
  };

  const unmountGame = async () => {
    if (!handleRef.current) return;
    const module = await import('@playmasters/space-blaster');
    const handle = handleRef.current;
    module.unmount(handle);
    handleRef.current = null;
    setReady(false);
    return handle;
  };

  const runCycles = async (cycles: number) => {
    if (!containerRef.current || running) return;
    setRunning(true);
    const nextSamples: CycleSample[] = [];
    try {
      for (let i = 1; i <= cycles; i += 1) {
        await mountGame();
        await wait(120);
        const handle = await unmountGame();
        await wait(80);
        const diagnosticsAfter = handle?.getDiagnostics();
        const canvasLeft =
          containerRef.current.querySelectorAll('canvas').length;
        const heapUsed =
          'memory' in performance
            ? ((
                performance as Performance & {
                  memory?: { usedJSHeapSize?: number };
                }
              ).memory?.usedJSHeapSize ?? 0) /
              (1024 * 1024)
            : undefined;
        nextSamples.push({
          cycle: i,
          activeCanvasCount: Math.max(
            canvasLeft,
            diagnosticsAfter?.activeCanvasCount ?? 0,
          ),
          activeDisposables: diagnosticsAfter?.activeDisposables ?? 0,
          heapUsedMb: heapUsed,
        });
      }
      setSamples(nextSamples);
    } finally {
      await unmountGame();
      setRunning(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Space Blaster Smoke Harness</h1>
      <p>
        Use this page to run repeated mount/unmount cycles and inspect teardown
        diagnostics.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => void mountGame()}
          disabled={running || !!handleRef.current}
        >
          Mount
        </button>
        <button
          onClick={() => void unmountGame()}
          disabled={running || !handleRef.current}
        >
          Unmount
        </button>
        <button onClick={() => void runCycles(10)} disabled={running}>
          Run 10 cycles
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <strong>Status:</strong>{' '}
        {running ? 'Running' : handleRef.current ? 'Mounted' : 'Unmounted'} /{' '}
        {ready ? 'READY' : 'NOT_READY'}
      </div>
      <div
        ref={containerRef}
        style={{
          width: 800,
          height: 450,
          border: '1px solid #ccc',
          marginBottom: 16,
          background: '#0b0d13',
        }}
      />
      <h2>Cycle samples</h2>
      <pre style={{ background: '#f4f4f4', padding: 12, overflowX: 'auto' }}>
        {JSON.stringify(samples, null, 2)}
      </pre>
      <p>
        Pass criteria: after each cycle, container canvas count returns to 0,
        active disposables return to 0, and heap trend is not monotonically
        climbing with large deltas.
      </p>
    </main>
  );
}
