/**
 * Fila de concorrência do embedding local. O pico de memória do onnxruntime cresce com o número de
 * inferências simultâneas (o modelo sozinho já usa ~1,2 GiB no container), então no processo roda no
 * máximo `maxConcurrent` por vez; as demais esperam na fila, e passando de `maxQueue` a chamada é
 * recusada na hora (a rota responde 503 com Retry-After) em vez de acumular trabalho e memória.
 */
export class EmbeddingBusyError extends Error {
  constructor() {
    super('Fila de embedding cheia.');
    this.name = 'EmbeddingBusyError';
  }
}

export interface EmbeddingLimiter {
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Tarefas rodando ou esperando. */
  readonly pending: number;
}

export function createEmbeddingLimiter(maxConcurrent: number, maxQueue: number): EmbeddingLimiter {
  const concurrency = Math.max(1, Math.floor(maxConcurrent));
  const queueLimit = Math.max(0, Math.floor(maxQueue));
  let running = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    running -= 1;
    const next = waiting.shift();
    if (next) next();
  };

  return {
    get pending() {
      return running + waiting.length;
    },
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (running >= concurrency) {
        if (waiting.length >= queueLimit) throw new EmbeddingBusyError();
        // O release acorda o próximo já contando a vaga dele (running continua alto, sem corrida).
        await new Promise<void>((resolve) => {
          waiting.push(() => {
            running += 1;
            resolve();
          });
        });
      } else {
        running += 1;
      }
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

/** Lê um inteiro positivo de uma variável de ambiente; qualquer outra coisa cai no padrão. */
export function readPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
