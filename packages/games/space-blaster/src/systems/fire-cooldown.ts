export class FireCooldown {
  private remainingMs = 0;

  constructor(private readonly cooldownMs: number) {}

  update(dtMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, dtMs));
  }

  canFire(): boolean {
    return this.remainingMs <= 0;
  }

  consume(): boolean {
    if (!this.canFire()) return false;
    this.remainingMs = this.cooldownMs;
    return true;
  }
}
