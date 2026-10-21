import { describe, expect, it } from 'vitest';
import { MAX_CONTENT_LENGTH, buildDrafts, buildPayloads, isImportCandidate, selectedDrafts } from '../import-logic';

const SKILL =
  '---\nname: revisar-contrato-api\ndescription: Revisa contratos OpenAPI. Use quando for publicar uma nova versão do contrato\n---\n\n# Revisar\n\nLeia o contrato.';

describe('importar pasta', () => {
  it('só considera arquivos .md', () => {
    expect(isImportCandidate('a/SKILL.md')).toBe(true);
    expect(isImportCandidate('a/imagem.png')).toBe(false);
  });

  it('SKILL.md vira skill com título do cabeçalho e etiquetas inferidas', () => {
    const [d] = buildDrafts([{ path: 'revisar-contrato-api/SKILL.md', text: SKILL }]);
    expect(d).toMatchObject({ type: 'skill', title: 'revisar-contrato-api', level: 'ok', blocked: false, selected: true });
    expect(d.tags).toEqual(expect.arrayContaining(['skill', 'revisar', 'contrato']));
    expect(d.description).toContain('Revisa contratos');
  });

  it('skill sem description é erro e não vem marcada', () => {
    const [d] = buildDrafts([{ path: 'x/SKILL.md', text: '---\nname: x-y\n---\n\ncorpo' }]);
    expect(d).toMatchObject({ level: 'erro', blocked: true, selected: false });
    expect(selectedDrafts([d])).toEqual([]);
  });

  it('skill com aviso entra mesmo assim', () => {
    const [d] = buildDrafts([{ path: 'x/SKILL.md', text: '---\nname: curta\ndescription: Curta\n---\n\ncorpo' }]);
    expect(d.level).toBe('aviso');
    expect(d.selected).toBe(true);
  });

  it('outros .md viram recurso, com aviso de descrição', () => {
    const [d] = buildDrafts([{ path: 'docs/checklist-revisao.md', text: '# Checklist\n- item' }]);
    expect(d).toMatchObject({ type: 'resource', title: 'checklist-revisao', level: 'aviso', blocked: false });
  });

  it('.md solto com cabeçalho name e description também é skill', () => {
    const [d] = buildDrafts([{ path: 'revisor.md', text: SKILL }]);
    expect(d.type).toBe('skill');
  });

  it('arquivo vazio ou acima do limite é erro', () => {
    const drafts = buildDrafts([
      { path: 'a.md', text: '   ' },
      { path: 'b.md', text: 'x'.repeat(MAX_CONTENT_LENGTH + 1) },
    ]);
    expect(drafts.map(d => d.blocked)).toEqual([true, true]);
  });

  it('monta o envio ligando cada payload ao arquivo de origem', () => {
    const drafts = buildDrafts([
      { path: 'a/SKILL.md', text: SKILL },
      { path: 'b.md', text: 'texto' },
    ]);
    const { payloads, byPayload } = buildPayloads(drafts, 'public', {
      authorId: 'me',
      authorName: 'Ana',
      authorRole: 'Analista',
      authorSquad: 'S',
      authorAvatar: '',
    });
    expect(payloads.map(p => p.type)).toEqual(['skill', 'resource']);
    expect(payloads[0]).toMatchObject({ visibility: 'public', authorId: 'me', status: 'producao', useCount: 0 });
    expect(byPayload.get(payloads[1])?.path).toBe('b.md');
  });
});
