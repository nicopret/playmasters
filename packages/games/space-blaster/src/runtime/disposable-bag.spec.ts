import { DisposableBag } from './disposable-bag';

describe('DisposableBag', () => {
  it('runs all disposers and clears the bag', () => {
    const bag = new DisposableBag();
    const calls: number[] = [];
    bag.add(() => calls.push(1));
    bag.add(() => calls.push(2));

    bag.disposeAll();

    expect(calls).toEqual([2, 1]);
    expect(bag.size()).toBe(0);
  });

  it('continues disposal when one disposer throws', () => {
    const bag = new DisposableBag();
    const calls: number[] = [];
    bag.add(() => calls.push(1));
    bag.add(() => {
      throw new Error('boom');
    });
    bag.add(() => calls.push(3));

    expect(() => bag.disposeAll()).not.toThrow();
    expect(calls).toEqual([3, 1]);
    expect(bag.size()).toBe(0);
  });
});
