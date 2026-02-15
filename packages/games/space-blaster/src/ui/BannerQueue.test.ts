import { BannerQueue } from './BannerQueue';

describe('BannerQueue', () => {
  it('queues multiple banners and plays sequentially', () => {
    const queue = new BannerQueue();
    queue.enqueue({ kind: 'INFO', message: 'A', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'B', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'C', durationMs: 1000 });

    queue.update(0);
    expect(queue.getActive()?.req.message).toBe('A');

    queue.update(999);
    expect(queue.getActive()?.req.message).toBe('A');

    queue.update(1000);
    expect(queue.getActive()?.req.message).toBe('B');

    queue.update(2000);
    expect(queue.getActive()?.req.message).toBe('C');
  });

  it('never has more than one active banner', () => {
    const queue = new BannerQueue();
    queue.enqueue({ kind: 'INFO', message: 'A', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'B', durationMs: 1000 });

    queue.update(0);
    const first = queue.getActive();
    queue.update(500);
    const second = queue.getActive();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.req.message).toBe('A');
  });

  it('uses sim-clock time and does not expire if nowMs is frozen', () => {
    const queue = new BannerQueue();
    queue.enqueue({ kind: 'INFO', message: 'A', durationMs: 1000 });

    queue.update(0);
    expect(queue.getActive()?.req.message).toBe('A');

    queue.update(0);
    queue.update(0);
    expect(queue.getActive()?.req.message).toBe('A');
  });

  it('caps queue length to prevent unbounded growth', () => {
    const queue = new BannerQueue(3);
    queue.enqueue({ kind: 'INFO', message: 'A', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'B', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'C', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'D', durationMs: 1000 });
    queue.enqueue({ kind: 'INFO', message: 'E', durationMs: 1000 });

    expect(queue.getQueueLength()).toBe(3);
    queue.update(0);
    expect(queue.getActive()?.req.message).toBe('C');
  });
});
