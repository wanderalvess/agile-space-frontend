import { describe, expect, it } from 'vitest';
import {
  HOME_GROUP_ORDER,
  MODULES,
  RITUAL_MODULE_KEYS,
  getModule,
  homeModuleGroups,
  moduleForPath,
  moduleIcon,
  primaryNavFor,
  modulesInGroup,
  searchModules,
  visibleModules,
} from '../modules-registry';

describe('registro de módulos', () => {
  it('chave, rota e ícone são únicos (um ícone por módulo)', () => {
    expect(new Set(MODULES.map((m) => m.key)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.href)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.icon)).size).toBe(MODULES.length);
  });

  it('tem os módulos pedidos, com as rotas de sempre', () => {
    const hrefs = Object.fromEntries(MODULES.map((m) => [m.key, m.href]));
    expect(hrefs).toMatchObject({
      home: '/',
      painel: '/squad?tab=resumo',
      squad: '/squad',
      roster: '/squad/roster',
      workspace: '/workspace',
      poker: '/room',
      retro: '/retro',
      showcase: '/showcase',
      health: '/health-check',
      brainstorming: '/brainstorming',
      'action-plan': '/action-plan',
      jolt: '/jolt',
      devtools: '/devtools',
      knowledge: '/knowledge/kb',
      'prompt-hub': '/prompt-hub',
      manual: '/manual',
      support: '/support',
      changelog: '/changelog',
      governance: '/governance',
      admin: '/admin',
      settings: '/configuracoes',
    });
  });

  it('nomes em PT-BR, sem "engenharia" e sem o nome antigo de governança', () => {
    const text = JSON.stringify(MODULES.map((m) => [m.label, m.description, m.aliases])).toLowerCase();
    expect(text).not.toContain('engenharia');
    expect(getModule('governance').label).toBe('Segurança e dados');
    expect(getModule('roster').label).toBe('Time da squad');
    expect(getModule('workspace').label).toBe('Meu espaço');
  });

  it('o menu Rituais lista cinco módulos de sessão', () => {
    expect(RITUAL_MODULE_KEYS).toHaveLength(5);
    for (const k of RITUAL_MODULE_KEYS) expect(getModule(k).group).toBe('rituais');
  });

  it('só administração é exclusiva de admin', () => {
    expect(MODULES.filter((m) => m.adminOnly).map((m) => m.key)).toEqual(['admin']);
    expect(visibleModules(false).some((m) => m.key === 'admin')).toBe(false);
    expect(visibleModules(true).some((m) => m.key === 'admin')).toBe(true);
  });

  it('moduleIcon devolve o ícone do registro', () => {
    expect(moduleIcon('poker')).toBe(getModule('poker').icon);
  });

  it('todo grupo tem ao menos um módulo', () => {
    for (const g of new Set(MODULES.map((m) => m.group))) expect(modulesInGroup(g).length).toBeGreaterThan(0);
  });
});

describe('cartões da Home', () => {
  it('são 11 em 4 grupos, na ordem de sempre (a Central de qualidade virou filtro do DevTools)', () => {
    const groups = homeModuleGroups();
    expect(groups.map((g) => g.id)).toEqual(HOME_GROUP_ORDER);
    expect(groups.flatMap((g) => g.items.map((m) => m.href))).toEqual([
      '/jolt', '/devtools',
      '/squad?tab=resumo', '/workspace', '/sprint-planner',
      '/health-check', '/brainstorming', '/action-plan',
      '/knowledge/kb', '/prompt-hub', '/support',
    ]);
  });
});

describe('searchModules', () => {
  it('consulta vazia devolve todos os visíveis', () => {
    expect(searchModules('').length).toBe(MODULES.length);
    expect(searchModules('', false).length).toBe(MODULES.length - 1);
  });
  it('ignora acento e caixa; acha por apelido', () => {
    expect(searchModules('RETROSPECTIVA')[0].key).toBe('retro');
    expect(searchModules('governanca')[0].key).toBe('governance');
    expect(searchModules('biblioteca de ia')[0].key).toBe('prompt-hub');
    expect(searchModules('changelog')[0].key).toBe('changelog');
  });
  it('nome vem antes de apelido e descrição', () => {
    expect(searchModules('squad')[0].key).toBe('squad');
  });
  it('esconde administração de quem não é admin', () => {
    expect(searchModules('administração', false)).toHaveLength(0);
    expect(searchModules('administração', true)[0].key).toBe('admin');
  });
  it('sem resultado devolve lista vazia', () => {
    expect(searchModules('zzzzz')).toEqual([]);
  });
});

describe('moduleForPath', () => {
  it('casa pelo prefixo mais longo', () => {
    expect(moduleForPath('/squad/roster')?.key).toBe('roster');
    expect(moduleForPath('/squad')?.key).toBe('squad');
    expect(moduleForPath('/squad/dashboards/member')?.key).toBe('squad');
    expect(moduleForPath('/knowledge/chat/abc')?.key).toBe('knowledge');
    expect(moduleForPath('/room/123')?.key).toBe('poker');
  });
  it('/qa continua casando com o DevTools (a rota só redireciona)', () => {
    expect(moduleForPath('/qa')?.key).toBe('devtools');
    expect(MODULES.some((m) => m.href === '/qa')).toBe(false);
  });
  it('a Home só casa na raiz', () => {
    expect(moduleForPath('/')?.key).toBe('home');
    expect(moduleForPath('/rota-desconhecida')).toBeUndefined();
  });
  it('não confunde prefixo parcial de nome', () => {
    expect(moduleForPath('/roomy')).toBeUndefined();
  });
});

describe('primaryNavFor', () => {
  it('agrupa as rotas nos itens da navegação principal', () => {
    expect(primaryNavFor('/')).toBe('home');
    expect(primaryNavFor('/painel')).toBe('squad');
    expect(primaryNavFor('/squad')).toBe('squad');
    expect(primaryNavFor('/squad/roster')).toBe('squad');
    expect(primaryNavFor('/workspace')).toBe('workspace');
    expect(primaryNavFor('/room/abc')).toBe('rituais');
    expect(primaryNavFor('/action-plan/1')).toBe('rituais');
    expect(primaryNavFor('/admin')).toBe('admin');
    expect(primaryNavFor('/devtools/json')).toBeNull();
  });
});
