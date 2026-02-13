export type DisposeFn = () => void;

export class DisposableBag {
  private disposers: DisposeFn[] = [];

  add(disposer: DisposeFn): void {
    this.disposers.push(disposer);
  }

  disposeAll(): void {
    for (let i = this.disposers.length - 1; i >= 0; i -= 1) {
      try {
        this.disposers[i]();
      } catch {
        // Teardown must continue even if an individual disposer fails.
      }
    }
    this.disposers = [];
  }

  size(): number {
    return this.disposers.length;
  }
}
