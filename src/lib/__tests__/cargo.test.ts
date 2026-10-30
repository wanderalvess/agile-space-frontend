import { describe, expect, it } from 'vitest';
import { canonicalCargo, resolveCargo, SEM_CARGO } from '../cargo';

describe('resolveCargo: o cargo é o da administração, sem fallback', () => {
  it('devolve o jobTitle aparado', () => {
    expect(resolveCargo('  Tech Lead ')).toBe('Tech Lead');
  });

  it('sem cargo definido devolve vazio (as telas mostram "Sem cargo")', () => {
    expect(resolveCargo()).toBe('');
    expect(resolveCargo(null)).toBe('');
    expect(resolveCargo('   ')).toBe('');
    expect(SEM_CARGO).toBe('Sem cargo');
  });

  it('nível de acesso não é cargo', () => {
    expect(resolveCargo('admin')).toBe('');
    expect(resolveCargo('User')).toBe('');
  });
});

describe('canonicalCargo: um cargo só para cada função', () => {
  it.each([
    'Developer', 'developer', 'Desenvolvedor', 'Desenvolvedora', 'Desenvolvedor(a)', 'DESENVOLVEDOR(A)', 'Dev', '  dev  ',
  ])('"%s" vira Desenvolvedor(a)', (v) => {
    expect(canonicalCargo(v)).toBe('Desenvolvedor(a)');
  });

  it.each([
    'QA', 'qa', 'Analista de QA', 'analista de qa', 'QA Engineer', 'Quality Assurance', 'Analista de Qualidade', ' Analista  de QA ',
  ])('"%s" vira Analista de QA', (v) => {
    expect(canonicalCargo(v)).toBe('Analista de QA');
  });

  it('ignora caixa, acento e espaços nas pontas', () => {
    expect(canonicalCargo('  DESENVOLVEDOR ')).toBe('Desenvolvedor(a)');
    expect(canonicalCargo('Desenvólvedor')).toBe('Desenvolvedor(a)');
    expect(canonicalCargo('Anályst de QA')).toBe('Anályst de QA');
  });

  it('a comparação é exata, nunca por "contém": outros cargos passam como vieram', () => {
    expect(canonicalCargo('Desenvolvedor Backend')).toBe('Desenvolvedor Backend');
    expect(canonicalCargo('Developer Advocate')).toBe('Developer Advocate');
    expect(canonicalCargo('QA Lead')).toBe('QA Lead');
    expect(canonicalCargo('Tech Lead')).toBe('Tech Lead');
    expect(canonicalCargo('  Tech Lead ')).toBe('Tech Lead');
    expect(canonicalCargo('Designer')).toBe('Designer');
  });

  it('vazio vira vazio', () => {
    expect(canonicalCargo()).toBe('');
    expect(canonicalCargo(null)).toBe('');
    expect(canonicalCargo('   ')).toBe('');
  });

  it('é idempotente', () => {
    for (const v of ['Developer', 'QA', 'Tech Lead', '']) expect(canonicalCargo(canonicalCargo(v))).toBe(canonicalCargo(v));
  });
});

describe('resolveCargo devolve o cargo canônico', () => {
  it('cargo gravado com a grafia antiga aparece com o nome canônico', () => {
    expect(resolveCargo('Developer')).toBe('Desenvolvedor(a)');
    expect(resolveCargo(' QA ')).toBe('Analista de QA');
    expect(resolveCargo('Desenvolvedor Backend')).toBe('Desenvolvedor Backend');
  });
});
