import { describe, expect, it } from 'vitest';
import { createEmbeddingLimiter, EmbeddingBusyError, readPositiveInt } from '../embedding-queue';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('createEmbeddingLimiter', () => {
  it('roda uma tarefa por vez e mantém a ordem de chegada', async () => {
    const limiter = createEmbeddingLimiter(1, 8);
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const gate = [deferred(), deferred(), deferred()];

    const task = (i: number) => limiter.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`start-${i}`);
      await gate[i].promise;
      order.push(`end-${i}`);
      active -= 1;
      return i;
    });

    const results = [task(0), task(1), task(2)];
    expect(limiter.pending).toBe(3);
    await Promise.resolve();
    expect(order).toEqual(['start-0']);

    gate[0].resolve();
    await results[0];
    await Promise.resolve();
    expect(order).toEqual(['start-0', 'end-0', 'start-1']);

    gate[1].resolve();
    gate[2].resolve();
    expect(await Promise.all(results)).toEqual([0, 1, 2]);
    expect(maxActive).toBe(1);
    expect(limiter.pending).toBe(0);
  });

  it('respeita a concorrência configurada', async () => {
    const limiter = createEmbeddingLimiter(2, 8);
    let active = 0;
    let maxActive = 0;
    const gate = deferred();
    const run = () => limiter.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gate.promise;
      active -= 1;
    });
    const all = [run(), run(), run(), run()];
    await Promise.resolve();
    expect(maxActive).toBe(2);
    gate.resolve();
    await Promise.all(all);
    expect(limiter.pending).toBe(0);
  });

  it('recusa na hora quando a fila passa do limite', async () => {
    const limiter = createEmbeddingLimiter(1, 1);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(async () => 'segunda');
    await expect(limiter.run(async () => 'terceira')).rejects.toBeInstanceOf(EmbeddingBusyError);
    gate.resolve();
    await first;
    expect(await second).toBe('segunda');
    expect(limiter.pending).toBe(0);
  });

  it('libera a vaga quando a tarefa falha', async () => {
    const limiter = createEmbeddingLimiter(1, 2);
    await expect(limiter.run(async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    expect(await limiter.run(async () => 'ok')).toBe('ok');
    expect(limiter.pending).toBe(0);
  });

  it('com fila 0 recusa qualquer tarefa extra enquanto uma roda', async () => {
    const limiter = createEmbeddingLimiter(1, 0);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    await expect(limiter.run(async () => 1)).rejects.toBeInstanceOf(EmbeddingBusyError);
    gate.resolve();
    await first;
  });
});

describe('readPositiveInt', () => {
  it('usa o valor válido e cai no padrão no resto', () => {
    expect(readPositiveInt('3', 1)).toBe(3);
    expect(readPositiveInt('2.9', 1)).toBe(2);
    expect(readPositiveInt(undefined, 5)).toBe(5);
    expect(readPositiveInt('', 5)).toBe(5);
    expect(readPositiveInt('0', 5)).toBe(5);
    expect(readPositiveInt('-4', 5)).toBe(5);
    expect(readPositiveInt('abc', 5)).toBe(5);
  });
});
