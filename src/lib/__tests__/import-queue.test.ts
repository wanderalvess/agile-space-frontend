import { describe, expect, it } from 'vitest';
import type { ProjectDetail } from '@/services/projectService';
import {
  abandonRemaining,
  addImported,
  addSkipped,
  createQueue,
  hasNext,
  isBatch,
  isFirstImport,
  pointAt,
  queueEndNotice,
  queueLabel,
} from '../import-queue';

const project = (id: string) => ({ id, name: id, members: [] }) as unknown as ProjectDetail;

describe('fila da importação', () => {
  it('uma chave só não é lote e não tem rótulo', () => {
    const q = createQueue(['A']);
    expect(isBatch(q)).toBe(false);
    expect(queueLabel(q)).toBeUndefined();
    expect(hasNext(q)).toBe(false);
  });

  it('várias chaves viram lote com "Squad N de M"', () => {
    let q = createQueue(['A', 'B', 'C']);
    expect(isBatch(q)).toBe(true);
    expect(queueLabel(q)).toBe('Squad 1 de 3');
    expect(hasNext(q)).toBe(true);
    q = pointAt(q, 2);
    expect(queueLabel(q)).toBe('Squad 3 de 3');
    expect(hasNext(q)).toBe(false);
  });

  it('a primeira gravada é a ativa; as outras não', () => {
    let q = createQueue(['A', 'B']);
    expect(isFirstImport(q)).toBe(true);
    q = addImported(q, project('A'));
    expect(isFirstImport(q)).toBe(false);
    expect(q.imported.map((p) => p.id)).toEqual(['A']);
  });

  it('é imutável: cada passo devolve uma fila nova', () => {
    const q = createQueue(['A', 'B']);
    const next = addSkipped(q, 'A');
    expect(q.skipped).toEqual([]);
    expect(next.skipped).toEqual(['A']);
  });

  it('voltar no meio da fila guarda o que foi gravado e conta o resto como não importado', () => {
    let q = createQueue(['A', 'B', 'C', 'D']);
    q = addImported(q, project('A'));
    q = pointAt(q, 1);
    q = addSkipped(q, 'B');
    q = pointAt(q, 2);
    const { done, skipped } = abandonRemaining(q);
    expect(done.map((p) => p.id)).toEqual(['A']);
    expect(skipped).toEqual(['B', 'C', 'D']);
  });

  it('aviso de fim de fila', () => {
    expect(queueEndNotice(0, [])).toEqual({ title: 'Nenhuma squad foi importada', description: undefined });
    expect(queueEndNotice(0, ['A', 'B'])).toEqual({ title: 'Nenhuma squad foi importada', description: 'Sem importar: A, B.' });
    expect(queueEndNotice(1, ['C'])).toEqual({ title: '1 importada', description: 'Sem importar: C.' });
    expect(queueEndNotice(2, ['C'])?.title).toBe('2 importadas');
    expect(queueEndNotice(2, [])).toBeNull();
  });
});
