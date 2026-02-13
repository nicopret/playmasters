import type * as Phaser from 'phaser';
import {
  integrateHorizontalMotion,
  type PlayerHorizontalMotionState,
} from './player-motion';

type Bounds = { minX: number; maxX: number };

export class PlayerController {
  private motionState: PlayerHorizontalMotionState;

  constructor(
    private readonly player: Phaser.GameObjects.Rectangle,
    private readonly body: Phaser.Physics.Arcade.Body,
    private readonly getBounds: () => Bounds,
    private readonly maxSpeedPxPerSec: number,
  ) {
    this.motionState = { x: this.player.x, velocityX: 0 };
  }

  resetPosition(x: number): void {
    this.motionState = { x, velocityX: 0 };
    this.player.setX(x);
    this.body.setVelocityX(0);
  }

  update(dtMs: number, inputAxis: number): void {
    const bounds = this.getBounds();
    const next = integrateHorizontalMotion(this.motionState, inputAxis, dtMs, {
      minX: bounds.minX,
      maxX: bounds.maxX,
      halfWidth: this.player.displayWidth / 2,
      maxSpeedPxPerSec: this.maxSpeedPxPerSec,
    });

    this.motionState = next;
    this.player.setX(next.x);
    this.body.setVelocityX(next.velocityX);
  }
}
