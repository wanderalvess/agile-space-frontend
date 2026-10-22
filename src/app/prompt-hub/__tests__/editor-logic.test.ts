import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, LIMITS, buildPayload, normalizeTag, publishBlock } from '../editor-logic';

const VALID_SKILL =
  '---\nname: revisar-contrato\ndescription: Revisa contratos OpenAPI. Use quando for publicar uma nova versão da API\n---\n\n# Revisar\n\n- Compare com a versão anterior.\n';

describe('editor: validação e envio', () => {
  it('pede título e conteúdo', () => {
    expect(buildPayload({ ...EMPTY_FORM }, '')).toMatchObject({ ok: false, title: 'Dê um título ao item' });
    expect(buildPayload({ ...EMPTY_FORM, title: 'T' }, '')).toMatchObject({ ok: false, title: 'Falta o conteúdo' });
    expect(publishBlock(EMPTY_FORM)).toMatch(/título/);
  });

  it('Gem aceita só o link da ferramenta', () => {
    const r = buildPayload({ ...EMPTY_FORM, title: 'Gem', type: 'gem', gemLink: 'https://gemini.google.com/gem/x' }, '');
    expect(r.ok).toBe(true);
  });

  it('skill com erro no SKILL.md não publica; aviso não bloqueia', () => {
    const bad = buildPayload({ ...EMPTY_FORM, title: 'S', type: 'skill', content: 'sem cabeçalho' }, '');
    expect(bad).toMatchObject({ ok: false, title: 'O SKILL.md ainda não está no formato' });
    expect(publishBlock({ ...EMPTY_FORM, title: 'S', type: 'skill', content: 'sem cabeçalho' })).toMatch(/Corrija 1 erro/);

    const warn = '---\nname: curta\ndescription: Curta\n---\n\nCorpo.';
    expect(buildPayload({ ...EMPTY_FORM, title: 'S', type: 'skill', content: warn }, '').ok).toBe(true);
    expect(buildPayload({ ...EMPTY_FORM, title: 'S', type: 'skill', content: VALID_SKILL }, '').ok).toBe(true);
  });

  it('a etiqueta digitada e não confirmada entra ao publicar', () => {
    const r = buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', tags: ['a'] }, ' #Jira ');
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.payload.tags).toEqual(['a', 'jira']);
  });

  it('limita a 30 etiquetas', () => {
    const tags = Array.from({ length: LIMITS.maxTags }, (_, i) => `t${i}`);
    expect(buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', tags }, 'nova')).toMatchObject({ ok: false });
    expect(buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', tags }, 't1').ok).toBe(true);
  });

  it('normaliza links e recusa esquemas perigosos', () => {
    const ok = buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', architectureLink: 'confluence.empresa.com/doc' }, '');
    if (ok.ok) expect(ok.payload.architectureLink).toBe('https://confluence.empresa.com/doc');
    expect(buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', architectureLink: 'javascript:alert(1)' }, '')).toMatchObject({
      ok: false,
      title: 'Link de documentação inválido',
    });
  });

  it('o link da ferramenta de um tipo que não o usa é apagado e não trava o envio', () => {
    const r = buildPayload({ ...EMPTY_FORM, title: 'T', type: 'prompt', content: 'x', gemLink: 'lixo antigo' }, '');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.gemLink).toBe('');
  });

  it('não devolve campos que só o servidor calcula', () => {
    const r = buildPayload({ ...EMPTY_FORM, title: 'T', content: 'x', favorite: true, canEdit: true, canModerate: true }, '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).not.toHaveProperty('favorite');
      expect(r.payload).not.toHaveProperty('canEdit');
      expect(r.payload).not.toHaveProperty('canModerate');
    }
  });

  it('normalizeTag tira #, caixa e espaços', () => {
    expect(normalizeTag('  #Code-Review ')).toBe('code-review');
  });
});
