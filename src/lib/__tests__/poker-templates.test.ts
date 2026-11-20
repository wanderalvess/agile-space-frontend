import { beforeEach, describe, expect, it } from 'vitest';
import { cleanTemplateName, deleteTemplate, listTemplates, renameTemplate, saveTemplate, templateFromRoom, TEMPLATE_NAME_MAX } from '../poker-templates';

beforeEach(() => localStorage.clear());

describe('templates do Scrum Poker (por navegador)', () => {
  it('nome limpo: espaços, tamanho máximo e nome padrão quando vazio', () => {
    expect(cleanTemplateName('  Refinamento   quinzenal ')).toBe('Refinamento quinzenal');
    expect(cleanTemplateName('x'.repeat(200))).toHaveLength(TEMPLATE_NAME_MAX);
    expect(cleanTemplateName('   ')).toBe('Template do Scrum Poker');
    expect(cleanTemplateName(undefined, 'Padrão')).toBe('Padrão');
  });

  it('templateFromRoom leva baralho, configurações (com horas máximas) e backlog', () => {
    const tpl = templateFromRoom({
      name: ' Meu template ',
      deckType: 'hours',
      settings: { autoReveal: false, maxHours: 24 },
      issues: [{ title: 'Tarefa 1', jiraLink: '', type: 'dev' }, { title: 'Tarefa 2', jiraLink: 'https://x/y', type: 'qa' }],
    });
    expect(tpl.name).toBe('Meu template');
    expect(tpl.deckType).toBe('hours');
    expect(tpl.settings.maxHours).toBe(24);
    expect(tpl.backlog).toEqual([{ title: 'Tarefa 1', jiraLink: undefined, type: 'dev' }, { title: 'Tarefa 2', jiraLink: 'https://x/y', type: 'qa' }]);
  });

  it('salvar, listar, renomear e excluir', () => {
    const a = saveTemplate(templateFromRoom({ name: 'A', deckType: 'fibonacci' }));
    const b = saveTemplate(templateFromRoom({ name: 'B', deckType: 'tshirt' }));
    expect(listTemplates().map((t) => t.name)).toEqual(['B', 'A']);

    expect(renameTemplate(a.id, '  Novo   nome ')).toBe(true);
    expect(listTemplates().find((t) => t.id === a.id)?.name).toBe('Novo nome');
    expect(renameTemplate(a.id, '   ')).toBe(true); // vazio mantém o nome anterior
    expect(listTemplates().find((t) => t.id === a.id)?.name).toBe('Novo nome');
    expect(renameTemplate('inexistente', 'x')).toBe(false);

    deleteTemplate(b.id);
    expect(listTemplates().map((t) => t.id)).toEqual([a.id]);
  });
});
