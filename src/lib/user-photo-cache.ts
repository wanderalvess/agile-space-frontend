/**
 * Cache em memória das fotos enviadas pelas pessoas (as dos colegas, que só a API serve, com Bearer).
 * Sem React: o hook `useUserPhoto` só assina aqui.
 *
 * - Um `blob:` por pessoa, dividido entre todos os avatares dela (contagem de uso em `refs`).
 * - Chamadas concorrentes para a mesma pessoa viram uma só (`jobs`).
 * - No máximo `MAX_CONCURRENT` buscas ao mesmo tempo; o resto espera na fila. Quem saiu de cena antes da vez
 *   (lista rolada, tela trocada) não gera busca.
 * - 404 ("sem foto") e falha de rede também ficam em cache, por pouco tempo, para não repetir a cada render.
 * - O `blob:` só é revogado quando sai do cache (substituído ou despejado) E ninguém mais o usa.
 */
import { userPhotoApi } from '@/lib/user-photo-api';

export const MAX_CONCURRENT = 4;
export const FOUND_TTL_MS = 15 * 60_000;
export const MISSING_TTL_MS = 5 * 60_000;
export const ERROR_TTL_MS = 30_000;
const MAX_ENTRIES = 400;

interface Entry {
  /** `null` = a pessoa não tem foto (ou a busca falhou). */
  url: string | null;
  expiresAt: number;
  refs: number;
  /** Já saiu do cache: revoga quando o último avatar largar. */
  retired: boolean;
}

interface Job {
  promise: Promise<Entry | null>;
  /** Avatares esperando esta busca. Zero na hora da vez = não busca. */
  waiters: number;
}

const entries = new Map<string, Entry>();
const jobs = new Map<string, Job>();
const queue: Array<() => void> = [];
let running = 0;
let generation = 0;

function revoke(entry: Entry) {
  if (entry.url) URL.revokeObjectURL(entry.url);
}

function retire(entry: Entry) {
  entry.retired = true;
  if (entry.refs <= 0) revoke(entry);
}

function drop(entry: Entry) {
  entry.refs -= 1;
  if (entry.refs <= 0 && entry.retired) revoke(entry);
}

function store(id: string, entry: Entry) {
  const old = entries.get(id);
  if (old) {
    entries.delete(id);
    retire(old);
  }
  entries.set(id, entry);
  // Passou do teto: despeja os mais antigos que ninguém usa.
  if (entries.size > MAX_ENTRIES) {
    for (const [key, e] of entries) {
      if (entries.size <= MAX_ENTRIES) break;
      if (e.refs <= 0 && key !== id) {
        entries.delete(key);
        retire(e);
      }
    }
  }
}

function freshEntry(id: string): Entry | undefined {
  const e = entries.get(id);
  return e && e.expiresAt > Date.now() ? e : undefined;
}

function pump() {
  while (running < MAX_CONCURRENT && queue.length > 0) queue.shift()!();
}

async function load(id: string): Promise<Pick<Entry, 'url' | 'expiresAt'>> {
  try {
    const blob = await userPhotoApi.fetchUserBlob(id);
    if (!blob) return { url: null, expiresAt: Date.now() + MISSING_TTL_MS };
    return { url: URL.createObjectURL(blob), expiresAt: Date.now() + FOUND_TTL_MS };
  } catch {
    // Rede fora, 5xx, 401...: iniciais por ora, e tenta de novo daqui a pouco.
    return { url: null, expiresAt: Date.now() + ERROR_TTL_MS };
  }
}

function startJob(id: string): Job {
  const job: Job = { waiters: 0, promise: undefined as unknown as Promise<Entry | null> };
  job.promise = new Promise<Entry | null>((resolve) => {
    queue.push(() => {
      if (job.waiters <= 0) {
        jobs.delete(id);
        resolve(null);
        return;
      }
      running += 1;
      const startedIn = generation;
      load(id)
        .then((loaded) => {
          if (startedIn !== generation) {
            // O cache foi zerado no meio da busca: não guarda nada (e não vaza o blob).
            if (loaded.url) URL.revokeObjectURL(loaded.url);
            resolve(null);
            return;
          }
          const entry: Entry = { ...loaded, refs: 0, retired: false };
          store(id, entry);
          resolve(entry);
        })
        .finally(() => {
          // Busca de antes do reset já não ocupa vaga (o contador foi zerado).
          if (startedIn === generation) running -= 1;
          if (jobs.get(id) === job) jobs.delete(id);
          pump();
        });
    });
  });
  jobs.set(id, job);
  return job;
}

/** `blob:` já em cache e ainda válido (leitura pura, sem reservar). */
export function peekUserPhoto(id: string): string | undefined {
  return freshEntry(id)?.url ?? undefined;
}

/**
 * Pede a foto de `id`. `onUrl` recebe o `blob:` (ou `undefined` se não há foto / falhou), na hora quando já está
 * em cache. A foto fica reservada até chamar a função devolvida, que deve ir no cleanup do efeito.
 */
export function subscribeUserPhoto(id: string, onUrl: (url: string | undefined) => void): () => void {
  let released = false;
  let held: Entry | null = null;

  const take = (entry: Entry) => {
    entry.refs += 1;
    held = entry;
    onUrl(entry.url ?? undefined);
  };

  const fresh = freshEntry(id);
  if (fresh) {
    take(fresh);
    return () => {
      if (released) return;
      released = true;
      if (held) drop(held);
      held = null;
    };
  }

  const job = jobs.get(id) ?? startJob(id);
  job.waiters += 1;
  // Só depois de contar quem espera: na vez da fila, job sem ninguém esperando é descartado.
  pump();
  let counted = true;
  const uncount = () => {
    if (counted) {
      counted = false;
      job.waiters -= 1;
    }
  };
  job.promise.then((entry) => {
    uncount();
    if (released || !entry) return;
    take(entry);
  });

  return () => {
    if (released) return;
    released = true;
    uncount();
    if (held) drop(held);
    held = null;
  };
}

/** Zera tudo (logout e testes). Busca em andamento é descartada sem guardar nada. */
export function resetUserPhotoCache() {
  generation += 1;
  entries.forEach((e) => {
    e.retired = true;
    revoke(e);
  });
  entries.clear();
  jobs.clear();
  queue.length = 0;
  running = 0;
}
