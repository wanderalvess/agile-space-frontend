import { describe, expect, it } from 'vitest';
import { AVATAR_TONE_COUNT, avatarToneIndex, initialsOf } from '../initials';

describe('initialsOf', () => {
  it('usa a primeira letra do primeiro e do último nome', () => {
    expect(initialsOf('Ana Ribeiro')).toBe('AR');
    expect(initialsOf('Ana Paula Costa Ribeiro')).toBe('AR');
  });
  it('preserva acento e coloca em maiúscula', () => {
    expect(initialsOf('álvaro ávila')).toBe('ÁÁ');
    expect(initialsOf('Érica Gonçalves')).toBe('ÉG');
    expect(initialsOf('ítalo')).toBe('Í');
  });
  it('um nome só dá uma letra', () => {
    expect(initialsOf('Diego')).toBe('D');
  });
  it('ignora preposições entre os nomes', () => {
    expect(initialsOf('Maria da Silva')).toBe('MS');
    expect(initialsOf('João de Souza e Silva')).toBe('JS');
    expect(initialsOf('Ana dos Santos')).toBe('AS');
  });
  it('se só sobrarem preposições, usa o que há', () => {
    expect(initialsOf('de da')).toBe('DD');
    expect(initialsOf('de')).toBe('D');
  });
  it('trata espaços extras', () => {
    expect(initialsOf('   Ana    Ribeiro  ')).toBe('AR');
    expect(initialsOf('\tcarla\n')).toBe('C');
  });
  it('sem nome, usa o e-mail', () => {
    expect(initialsOf('', 'ana.silva@totvs.com.br')).toBe('AS');
    expect(initialsOf(undefined, 'carlos@totvs.com.br')).toBe('C');
    expect(initialsOf(null, 'carlos_souza@x.com')).toBe('CS');
  });
  it('e-mail no lugar do nome também funciona', () => {
    expect(initialsOf('ana.silva@totvs.com.br')).toBe('AS');
  });
  it('o nome tem prioridade sobre o e-mail', () => {
    expect(initialsOf('Bruno Lima', 'zeca@x.com')).toBe('BL');
  });
  it('ignora sinais no começo da palavra', () => {
    expect(initialsOf('(Ana) Ribeiro')).toBe('AR');
  });
  it('sem nada devolve "?"', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
    expect(initialsOf('   ', '  ')).toBe('?');
    expect(initialsOf('---')).toBe('?');
  });
});

describe('avatarToneIndex', () => {
  it('é estável para a mesma pessoa e fica entre 0 e 7', () => {
    const a = avatarToneIndex('Ana Ribeiro');
    expect(avatarToneIndex('Ana Ribeiro')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(AVATAR_TONE_COUNT);
  });
  it('não diferencia caixa, espaços nas pontas nem acento', () => {
    expect(avatarToneIndex('  ÁLVARO  ')).toBe(avatarToneIndex('alvaro'));
  });
  it('sem nome usa o e-mail', () => {
    expect(avatarToneIndex('', 'a@b.com')).toBe(avatarToneIndex('a@b.com'));
  });
  it('espalha nomes diferentes por vários tons', () => {
    const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas'];
    const tons = new Set(nomes.map((n) => avatarToneIndex(n)));
    expect(tons.size).toBeGreaterThanOrEqual(4);
  });
});
