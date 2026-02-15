export type BannerKind =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'TIER'
  | 'WAVE'
  | 'SYSTEM';

export interface BannerRequest {
  id?: string;
  kind: BannerKind;
  message: string;
  durationMs: number;
  priority?: number;
}

export interface ActiveBanner {
  req: BannerRequest;
  startedAtMs: number;
  endsAtMs: number;
}

const DEFAULT_MAX_QUEUE_SIZE = 20;

export class BannerQueue {
  private readonly maxQueueSize: number;
  private queue: BannerRequest[] = [];
  private active: ActiveBanner | null = null;

  constructor(maxQueueSize = DEFAULT_MAX_QUEUE_SIZE) {
    this.maxQueueSize = Math.max(1, Math.floor(maxQueueSize));
  }

  enqueue(request: BannerRequest): void {
    const durationMs = Number.isFinite(request.durationMs)
      ? Math.max(0, Math.floor(request.durationMs))
      : 0;
    const req: BannerRequest = {
      ...request,
      durationMs,
    };

    if (req.id) {
      const existingActiveId = this.active?.req.id;
      if (existingActiveId === req.id) {
        return;
      }
      if (this.queue.some((queued) => queued.id === req.id)) {
        return;
      }
    }

    this.queue.push(req);
    while (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }
  }

  update(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      return;
    }

    if (!this.active && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.active = {
          req: next,
          startedAtMs: nowMs,
          endsAtMs: nowMs + next.durationMs,
        };
      }
      return;
    }

    if (this.active && nowMs >= this.active.endsAtMs) {
      this.active = null;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) {
          this.active = {
            req: next,
            startedAtMs: nowMs,
            endsAtMs: nowMs + next.durationMs,
          };
        }
      }
    }
  }

  getActive(): ActiveBanner | null {
    return this.active;
  }

  dismissActive(): void {
    this.active = null;
  }

  clear(): void {
    this.queue = [];
    this.active = null;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
