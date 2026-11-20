import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEVTOOLS,
  DEVTOOL_GROUPS,
  HUB_TABS,
  LEGACY_ROUTES,
  QA_REDIRECT_HREF,
  QUALITY_TOOLS,
  getDevTool,
  getDevToolHref,
  isLocalTool,
  legacyRedirectHref,
  normalizeTab,
  toolBadge,
} from '../registry';

const APP = path.resolve(__dirname, '../../../app');

describe('registro do DevTools', () => {
  it('tem 25 cartões em 5 grupos, com ids únicos', () => {
    expect(DEVTOOLS).toHaveLength(25);
    expect(new Set(DEVTOOLS.map((t) => t.id)).size).toBe(25);
    expect(DEVTOOL_GROUPS.map((g) => g.id)).toEqual(['dados', 'codificacao', 'texto', 'rede', 'testes']);
    for (const g of DEVTOOL_GROUPS) expect(DEVTOOLS.some((t) => t.group === g.id)).toBe(true);
  });

  it('distribui as ferramentas pelos grupos como no desenho (3, 4, 8, 4, 6)', () => {
    const count = (g: string) => DEVTOOLS.filter((t) => t.group === g).length;
    expect([count('dados'), count('codificacao'), count('texto'), count('rede'), count('testes')]).toEqual([3, 4, 8, 4, 6]);
  });

  it('o filtro Qualidade marca 12 ferramentas de vários grupos', () => {
    expect(QUALITY_TOOLS.map((t) => t.id).sort()).toEqual(
      ['automation', 'api-client', 'bdd-bugs', 'data-studio', 'diff', 'fuzz', 'junit-generator', 'jwt-inspector', 'regex-lab', 'test-data', 'uuid-generator', 'zephyr'].sort(),
    );
    expect(new Set(QUALITY_TOOLS.map((t) => t.group)).size).toBeGreaterThan(2);
  });

  it('as pílulas do hub são Todas, os 5 grupos, Qualidade, Favoritas e Recentes', () => {
    expect(HUB_TABS).toEqual(['todas', 'dados', 'codificacao', 'texto', 'rede', 'testes', 'qualidade', 'favoritas', 'recentes']);
  });

  it('não sobra o status "em breve" nem a ferramenta de mocks', () => {
    expect(JSON.stringify(DEVTOOLS)).not.toMatch(/"status"|em breve/i);
    expect(getDevTool('mocks')).toBeUndefined();
  });

  it('cinco cartões usam serviço externo (o JUnit, só se houver chave) e os demais rodam no navegador', () => {
    const external = DEVTOOLS.filter((t) => !isLocalTool(t)).map((t) => t.id).sort();
    expect(external).toEqual(['api-client', 'cep', 'ip-analyzer', 'junit-generator', 'zephyr']);
    expect(toolBadge(getDevTool('cep')!)).toMatchObject({ label: 'Usa serviço externo', external: true, tip: 'viacep.com.br' });
    expect(toolBadge(getDevTool('junit-generator')!).label).toBe('Serviço externo opcional');
    expect(toolBadge(getDevTool('jwt-inspector')!)).toMatchObject({ label: 'Roda no navegador', external: false });
  });

  it('o aviso do CEP nomeia o serviço e nenhum texto promete que nada sai da máquina', () => {
    expect(getDevTool('cep')!.network!.notice).toContain('viacep.com.br');
    expect(JSON.stringify(DEVTOOLS)).not.toContain('não sai da sua máquina');
    expect(JSON.stringify(DEVTOOLS).toLowerCase()).not.toContain('engenharia');
  });

  it('as fundidas trazem as abas do desenho', () => {
    expect(getDevTool('data-studio')!.tabs!.map((t) => t.id)).toEqual(['formatar', 'converter', 'schema']);
    expect(getDevTool('encoding')!.tabs!.map((t) => t.id)).toEqual(['base64', 'url', 'camadas']);
    expect(getDevTool('diff')!.tabs!.map((t) => t.id)).toEqual(['texto', 'json', 'contrato']);
    expect(getDevTool('test-data')!.tabs!.map((t) => t.id)).toEqual(['gerar', 'validar']);
  });

  it('normalizeTab cai na primeira aba quando o valor não existe', () => {
    const t = getDevTool('encoding');
    expect(normalizeTab(t, 'url')).toBe('url');
    expect(normalizeTab(t, 'xyz')).toBe('base64');
    expect(normalizeTab(t, null)).toBe('base64');
    expect(normalizeTab(getDevTool('cep'), 'url')).toBeUndefined();
  });

  it('href da ferramenta, com ou sem aba', () => {
    expect(getDevToolHref('regex-lab')).toBe('/devtools/regex-lab');
    expect(getDevToolHref('diff', 'contrato')).toBe('/devtools/diff?aba=contrato');
  });

  it('toda ferramenta tem a página da rota', () => {
    for (const t of DEVTOOLS) expect(existsSync(path.join(APP, 'devtools', t.id, 'page.tsx')), t.id).toBe(true);
  });
});

describe('rotas antigas', () => {
  it('cada rota antiga redireciona para a ferramenta fundida, na aba certa', () => {
    const expected: Record<string, string> = {
      json: '/devtools/data-studio?aba=formatar&formato=json',
      xml: '/devtools/data-studio?aba=formatar&formato=xml',
      'yaml-converter': '/devtools/data-studio?aba=converter&de=yaml&para=json',
      'sql-formatter': '/devtools/data-studio?aba=formatar&formato=sql',
      'json-schema': '/devtools/data-studio?aba=schema',
      base64: '/devtools/encoding?aba=base64',
      'url-encoder': '/devtools/encoding?aba=url',
      'deep-decoder': '/devtools/encoding?aba=camadas',
      'api-diff': '/devtools/diff?aba=contrato',
      'doc-generator': '/devtools/test-data?aba=gerar&tipo=cpf',
      mocks: '/devtools',
    };
    for (const [slug, href] of Object.entries(expected)) expect(legacyRedirectHref(slug), slug).toBe(href);
    expect(Object.keys(LEGACY_ROUTES).sort()).toEqual(Object.keys(expected).sort());
  });

  it('o destino de cada redirect existe e a aba pedida é uma aba da ferramenta', () => {
    for (const [slug, target] of Object.entries(LEGACY_ROUTES)) {
      if (!target) continue;
      const tool = getDevTool(target.tool);
      expect(tool, slug).toBeTruthy();
      expect(tool!.tabs!.map((t) => t.id), slug).toContain(target.params.aba);
    }
  });

  it('as rotas antigas continuam existindo como página de redirecionamento', () => {
    for (const slug of Object.keys(LEGACY_ROUTES)) {
      const file = path.join(APP, 'devtools', slug, 'page.tsx');
      expect(existsSync(file), slug).toBe(true);
      const src = readFileSync(file, 'utf8');
      expect(src).toContain('redirect(');
      expect(src).toContain(`legacyRedirectHref('${slug}')`);
    }
  });

  it('/qa continua viva e redireciona para o filtro Qualidade', () => {
    expect(QA_REDIRECT_HREF).toBe('/devtools?grupo=qualidade');
    const src = readFileSync(path.join(APP, 'qa', 'page.tsx'), 'utf8');
    expect(src).toContain('redirect(QA_REDIRECT_HREF)');
  });

  it('a rota pública /api/mock também saiu junto com o Estúdio de Mocks', () => {
    expect(existsSync(path.join(APP, 'api', 'mock'))).toBe(false);
  });

  it('o Estúdio de Mocks saiu: nem a rota de configuração do frontend', () => {
    expect(existsSync(path.join(APP, 'api', 'mock-config'))).toBe(false);
  });
});
