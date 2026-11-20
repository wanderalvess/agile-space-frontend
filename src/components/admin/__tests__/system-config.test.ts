import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_TAB_TITLE,
  changedConfigKeys,
  failedKeysLabel,
  formFromServer,
  hslCss,
  isConfigValid,
  isValidHsl,
  normalizeHsl,
  tabTitleFor,
  validateConfig,
} from '../system-config';

describe('configurações do sistema', () => {
  it('valida o formato HSL "H S% L%"', () => {
    expect(isValidHsl('24 93% 53%')).toBe(true);
    expect(isValidHsl('  220   70%  50% ')).toBe(true);
    expect(isValidHsl('24.5 93.5% 53%')).toBe(true);
    expect(isValidHsl('')).toBe(true); // vazio = cor do tema
    expect(isValidHsl('24 93 53')).toBe(false);
    expect(isValidHsl('24, 93%, 53%')).toBe(false);
    expect(isValidHsl('hsl(24 93% 53%)')).toBe(false);
    expect(isValidHsl('361 50% 50%')).toBe(false);
    expect(isValidHsl('24 101% 50%')).toBe(false);
    expect(isValidHsl('#ff6a00')).toBe(false);
  });

  it('normaliza espaços e gera o valor de CSS só para cor válida', () => {
    expect(normalizeHsl('  24   93%  53% ')).toBe('24 93% 53%');
    expect(hslCss('24 93% 53%')).toBe('hsl(24 93% 53%)');
    expect(hslCss('')).toBeNull();
    expect(hslCss('24 93 53')).toBeNull();
  });

  it('título da aba: padrão do portal ou "Nome | Gestão Ágil"', () => {
    expect(tabTitleFor('Portal Tech V&D')).toBe(DEFAULT_TAB_TITLE);
    expect(tabTitleFor('Espaço Ágil')).toBe(DEFAULT_TAB_TITLE);
    expect(tabTitleFor('  ')).toBe(DEFAULT_TAB_TITLE);
    expect(tabTitleFor('Acme')).toBe('Acme | Gestão Ágil');
  });

  it('validação do formulário', () => {
    expect(validateConfig({ companyName: 'Acme', primaryColor: '24 93% 53%' })).toEqual({ companyName: null, primaryColor: null });
    expect(validateConfig({ companyName: ' ', primaryColor: '24 93 53' })).toEqual({
      companyName: 'Informe o nome da empresa',
      primaryColor: 'Use o formato 24 93% 53%',
    });
    expect(isConfigValid(DEFAULT_SYSTEM_CONFIG)).toBe(true);
    expect(isConfigValid({ companyName: 'Acme', primaryColor: 'azul' })).toBe(false);
  });

  it('só grava as chaves que mudaram (e nunca as removidas)', () => {
    const saved = { companyName: 'Portal Tech V&D', primaryColor: '24 93% 53%' };
    expect(changedConfigKeys(saved, saved)).toEqual([]);
    expect(changedConfigKeys(saved, { ...saved, companyName: 'Acme' })).toEqual(['companyName']);
    expect(changedConfigKeys(saved, { ...saved, primaryColor: '' })).toEqual(['primaryColor']);
    expect(changedConfigKeys(saved, { ...saved, primaryColor: '24  93%  53%' })).toEqual([]);
    expect(Object.keys(DEFAULT_SYSTEM_CONFIG).sort()).toEqual(['companyName', 'primaryColor']);
  });

  it('lê do servidor: vazio ou só espaços limpa a cor; nome ausente volta ao padrão', () => {
    expect(formFromServer({ companyName: '', primaryColor: ' ' })).toEqual(DEFAULT_SYSTEM_CONFIG);
    expect(formFromServer({ companyName: ' Acme ', primaryColor: '24  93% 53%' })).toEqual({ companyName: 'Acme', primaryColor: '24 93% 53%' });
  });

  it('nomeia o que falhou ao salvar', () => {
    expect(failedKeysLabel(['primaryColor'])).toBe('cor primária');
    expect(failedKeysLabel(['companyName', 'primaryColor'])).toBe('nome da empresa e cor primária');
  });
});
