import type * as Phaser from 'phaser';
import type { PoolLeakReport, PoolMetricsSnapshot } from './poolLeakChecks';

type PoolMetricsOverlayOptions = {
  scene: Phaser.Scene;
  getMetrics: () => PoolMetricsSnapshot;
  updateIntervalMs?: number;
};

export class PoolMetricsOverlay {
  private readonly scene: Phaser.Scene;
  private readonly getMetrics: () => PoolMetricsSnapshot;
  private readonly updateIntervalMs: number;
  private readonly text: Phaser.GameObjects.Text;
  private leakReport: PoolLeakReport = { atBaseline: true, issues: [] };
  private lastUpdateMs = -Infinity;

  constructor(options: PoolMetricsOverlayOptions) {
    this.scene = options.scene;
    this.getMetrics = options.getMetrics;
    this.updateIntervalMs = Math.max(100, options.updateIntervalMs ?? 400);
    this.text = this.scene.add
      .text(8, 8, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#bfe6ff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 6, y: 4 },
      })
      .setDepth(3500)
      .setScrollFactor(0);
    this.refreshNow(0);
  }

  update(nowMs: number): void {
    if (!Number.isFinite(nowMs)) {
      return;
    }
    if (nowMs - this.lastUpdateMs < this.updateIntervalMs) {
      return;
    }
    this.refreshNow(nowMs);
  }

  setLeakReport(report: PoolLeakReport): void {
    this.leakReport = report;
    this.refreshNow(this.lastUpdateMs);
  }

  destroy(): void {
    this.text.destroy();
  }

  private refreshNow(nowMs: number): void {
    this.lastUpdateMs = nowMs;
    const metrics = this.getMetrics();
    const lines = [
      '[DEV] Pool Metrics',
      `PB  a:${metrics.playerBullets.active} f:${metrics.playerBullets.free} t:${metrics.playerBullets.total}/${metrics.playerBullets.max}`,
      `EB  a:${metrics.enemyBullets.active} f:${metrics.enemyBullets.free} t:${metrics.enemyBullets.total}/${metrics.enemyBullets.max}`,
      `EXP a:${metrics.explosions.active} f:${metrics.explosions.free} t:${metrics.explosions.total}/${metrics.explosions.max}`,
      `PAR inUse:${metrics.particles.inUse}/${metrics.particles.max} bursts:${metrics.particles.activeBursts}`,
    ];
    if (!this.leakReport.atBaseline) {
      lines.push(`[LEAK] ${this.leakReport.issues[0]}`);
    }
    this.text.setText(lines.join('\n'));
  }
}
