import { describe, it, expect } from 'vitest';
import { retroExport } from '../retro-export.js';

describe('retroExport - Classificação de Horas e Etapas para a Retrospectiva', () => {

  describe('Classificação de Horas por Tipo de Demanda (horasCat)', () => {
    it('deve classificar demandas de legislação corretamente', () => {
      expect(retroExport.horasCat('Legislação Fiscal')).toBe('legislacao');
      expect(retroExport.horasCat('Ajuste Legisla')).toBe('legislacao');
    });

    it('deve classificar reuniões e gestão como participativo', () => {
      expect(retroExport.horasCat('Reunião de Alinhamento')).toBe('participativo');
      expect(retroExport.horasCat('Gestão de Mudança')).toBe('participativo');
      expect(retroExport.horasCat('Trabalho Participativo')).toBe('participativo');
    });

    it('deve classificar testes e homologação como teste', () => {
      expect(retroExport.horasCat('Teste de Regressão')).toBe('teste');
      expect(retroExport.horasCat('Homologação')).toBe('teste');
      expect(retroExport.horasCat('Aceite de Usuário')).toBe('teste');
      expect(retroExport.horasCat('Análise QA')).toBe('teste');
    });

    it('deve classificar histórias, desenvolvimento e débito técnico como inovacao', () => {
      expect(retroExport.horasCat('User Story')).toBe('inovacao');
      expect(retroExport.horasCat('Codificação de Feature')).toBe('inovacao');
      expect(retroExport.horasCat('Débito Técnico')).toBe('inovacao');
      expect(retroExport.horasCat('Spike de Arquitetura')).toBe('inovacao');
      expect(retroExport.horasCat('Desenvolvimento Backend')).toBe('inovacao');
    });

    it('deve classificar manutenções, defeitos e correções como sustentacao', () => {
      expect(retroExport.horasCat('Manutenção Corretiva')).toBe('sustentacao');
      expect(retroExport.horasCat('Defeito em Produção')).toBe('sustentacao');
      expect(retroExport.horasCat('Apoio ao Cliente')).toBe('sustentacao');
      expect(retroExport.horasCat('Correção de Emergência')).toBe('sustentacao');
    });

    it('deve usar sustentacao como fallback para tipos desconhecidos ou nulos', () => {
      expect(retroExport.horasCat('Outro Tipo')).toBe('sustentacao');
      expect(retroExport.horasCat(null as any)).toBe('sustentacao');
      expect(retroExport.horasCat('')).toBe('sustentacao');
    });
  });

  describe('Classificação de Etapas de Cycle Time (cycleStage)', () => {
    it('deve identificar fila de espera para revisão', () => {
      expect(retroExport.cycleStage('Aguardando Revisão')).toBe('esperaRevisao');
      expect(retroExport.cycleStage('Espera Revisão')).toBe('esperaRevisao');
      expect(retroExport.cycleStage('Aguardando Code Review')).toBe('esperaRevisao');
    });

    it('deve identificar fila de espera para teste', () => {
      expect(retroExport.cycleStage('Aguardando Teste')).toBe('esperaTeste');
      expect(retroExport.cycleStage('Espera Teste')).toBe('esperaTeste');
      expect(retroExport.cycleStage('Aguardando Homologação')).toBe('esperaTeste');
    });

    it('deve identificar etapa de revisão ativa', () => {
      expect(retroExport.cycleStage('Code Review')).toBe('revisao');
      expect(retroExport.cycleStage('Em Revisão')).toBe('revisao');
    });

    it('deve identificar etapa de teste ativo', () => {
      expect(retroExport.cycleStage('Em Teste')).toBe('teste');
      expect(retroExport.cycleStage('Homologando')).toBe('teste');
      expect(retroExport.cycleStage('Em QA')).toBe('teste');
    });

    it('deve identificar etapa de codificação ativa', () => {
      expect(retroExport.cycleStage('Em Desenvolvimento')).toBe('codificacao');
      expect(retroExport.cycleStage('Em Andamento')).toBe('codificacao');
      expect(retroExport.cycleStage('Doing')).toBe('codificacao');
      expect(retroExport.cycleStage('In Progress')).toBe('codificacao');
    });

    it('deve retornar null para status sem mapeamento de cycle', () => {
      expect(retroExport.cycleStage('Backlog')).toBeNull();
      expect(retroExport.cycleStage('Done')).toBeNull();
      expect(retroExport.cycleStage(null as any)).toBeNull();
    });
  });

  describe('Extração de Rótulos de Campos Customizados (fieldLabels)', () => {
    it('deve extrair rótulo de objeto com propriedade value', () => {
      expect(retroExport.fieldLabels({ value: 'Financeiro' })).toEqual(['Financeiro']);
    });

    it('deve extrair rótulo de string simples', () => {
      expect(retroExport.fieldLabels('Varejo')).toEqual(['Varejo']);
    });

    it('deve extrair múltiplos rótulos de arrays', () => {
      expect(retroExport.fieldLabels([{ value: 'Cliente A' }, 'Cliente B'])).toEqual(['Cliente A', 'Cliente B']);
    });

    it('deve retornar array vazio para valores nulos ou indefinidos', () => {
      expect(retroExport.fieldLabels(null)).toEqual([]);
      expect(retroExport.fieldLabels(undefined)).toEqual([]);
    });
  });

  describe('Dicionários de Apresentação (ROLE_FULL e CLIENTE_IGNORE)', () => {
    it('deve expandir siglas de papel para nomes por extenso', () => {
      expect(retroExport.ROLE_FULL.AM).toBe('Agile Master');
      expect(retroExport.ROLE_FULL.PO).toBe('Product Owner');
      expect(retroExport.ROLE_FULL.DEV).toBe('Desenvolvedor(a)');
      expect(retroExport.ROLE_FULL.QA).toBe('Quality Assurance');
    });

    it('deve conter totvs interno na lista de clientes ignorados', () => {
      expect(retroExport.CLIENTE_IGNORE.has('totvs interno')).toBe(true);
    });
  });
});
