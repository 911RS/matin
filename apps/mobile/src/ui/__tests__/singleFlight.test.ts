import { createSingleFlight } from '../useSingleFlight';

describe('createSingleFlight', () => {
  it('ignores a second run while the first is in flight', async () => {
    const flight = createSingleFlight();
    let release!: () => void;
    const task = jest.fn(() => new Promise<string>((r) => (release = () => r('done'))));
    const first = flight.run(task);
    const second = flight.run(task);
    expect(flight.busy()).toBe(true);
    release();
    await expect(first).resolves.toBe('done');
    await expect(second).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
    expect(flight.busy()).toBe(false);
  });

  it('runs again after a failure', async () => {
    const flight = createSingleFlight();
    await expect(flight.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(flight.run(async () => 1)).resolves.toBe(1);
  });
});
