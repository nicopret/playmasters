import { type FormationEnemy } from './FormationSystem';

type EnemyFireFormationSource = {
  pickEligibleShooter: (randomFloat?: () => number) => FormationEnemy | null;
};

type EnemyFireWeapon = {
  tryFire: (originX: number, originY: number, directionY: number) => boolean;
};

type EnemyFireSystemOptions = {
  formation: EnemyFireFormationSource;
  weapon: EnemyFireWeapon;
  fireChancePerSecond: number;
  muzzleOffsetY?: number;
  randomFloat?: () => number;
};

const DEFAULT_MUZZLE_OFFSET_Y = 12;

export class EnemyFireSystem {
  private readonly formation: EnemyFireFormationSource;
  private readonly weapon: EnemyFireWeapon;
  private readonly fireChancePerSecond: number;
  private readonly muzzleOffsetY: number;
  private readonly randomFloat: () => number;

  constructor(options: EnemyFireSystemOptions) {
    this.formation = options.formation;
    this.weapon = options.weapon;
    this.fireChancePerSecond = options.fireChancePerSecond;
    this.muzzleOffsetY = options.muzzleOffsetY ?? DEFAULT_MUZZLE_OFFSET_Y;
    this.randomFloat = options.randomFloat ?? Math.random;
  }

  update(simDtMs: number): boolean {
    if (simDtMs <= 0 || this.fireChancePerSecond <= 0) {
      return false;
    }

    const probability = Math.min(
      1,
      this.fireChancePerSecond * (simDtMs / 1000),
    );
    if (this.randomFloat() >= probability) {
      return false;
    }

    const shooter = this.formation.pickEligibleShooter(this.randomFloat);
    if (!shooter) {
      return false;
    }

    return this.weapon.tryFire(shooter.x, shooter.y + this.muzzleOffsetY, 1);
  }
}
