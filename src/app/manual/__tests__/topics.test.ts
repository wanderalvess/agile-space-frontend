import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES, moduleIcon, moduleLabel } from '../../../lib/modules-registry';
import { getModuleIntegration } from '../../../lib/integration-catalog';
import packageInfo from '../../../../package.json';
import { TOPIC_CONTENT } from '../content';
import { bodyText } from '../data/search';
import { MANUAL_CATEGORIES, MANUAL_TOPICS, getTopicById, neighborsOf, resolveTopicId, topicsInCategory } from '../data/topics';

const appDir = path.resolve(__dirname, '../..');
const manualDir = path.resolve(__dirname, '..');

/** Tópicos sem módulo no registro: único caso com ícone próprio. */
const OWN_ICON = ['integracoes', 'primeiros-passos', 'manifesto', 'qualidade'];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== '__tests__') sources(full, out);
    } else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const allText = () =>
  MANUAL_TOPICS.map((t) => [t.title, t.summary, t.actionLabel ?? '', ...t.keywords, bodyText(TOPIC_CONTENT[t.id])].join('\n')).join('\n');

describe('manual: consistência dos tópicos', () => {
  it('todo tópico tem conteúdo, categoria válida, id único e vice-versa', () => {
    const ids = MANUAL_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(MANUAL_CATEGORIES.map((c) => c.id));
    for (const t of MANUAL_TOPICS) {
      expect(TOPIC_CONTENT[t.id], `sem conteúdo: ${t.id}`).toBeTruthy();
      expect(categories.has(t.category), `categoria inválida: ${t.id}`).toBe(true);
    }
    for (const id of Object.keys(TOPIC_CONTENT)) expect(ids, `conteúdo sem tópico: ${id}`).toContain(id);
  });

  it('são cinco categorias novas, todas com tópicos, e os tópicos seguem a ordem das categorias', () => {
    expect(MANUAL_CATEGORIES.map((c) => c.label)).toEqual(['Cerimônias', 'Time e acompanhamento', 'Conhecimento e IA', 'Ferramentas', 'Conta e ajuda']);
    for (const c of MANUAL_CATEGORIES) expect(topicsInCategory(c.id).length, c.label).toBeGreaterThan(0);
    const order = MANUAL_TOPICS.map((t) => MANUAL_CATEGORIES.findIndex((c) => c.id === t.category));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('todos os tópicos pedidos existem', () => {
    for (const id of ['poker', 'retro', 'showcase', 'health', 'brainstorming', 'planner', 'action-plan', 'painel', 'workspace', 'qualidade', 'knowledge', 'prompt-hub', 'jolt', 'devtools', 'integracoes', 'primeiros-passos', 'governance', 'suporte', 'versoes', 'admin', 'manifesto']) {
      expect(getTopicById(id), id).toBeTruthy();
    }
  });

  it('todo botão de ação aponta para uma rota que existe em src/app', () => {
    for (const t of MANUAL_TOPICS) {
      if (!t.actionUrl) continue;
      expect(t.actionLabel, `sem rótulo: ${t.id}`).toBeTruthy();
      const segments = t.actionUrl.split('?')[0].split('/').filter(Boolean);
      expect(fs.existsSync(path.join(appDir, ...segments, 'page.tsx')), `rota inexistente para ${t.id}: ${t.actionUrl}`).toBe(true);
    }
  });

  it('"Veja também" só aponta para tópicos que existem e nunca para si mesmo', () => {
    for (const t of MANUAL_TOPICS) {
      for (const r of t.related) {
        expect(getTopicById(r), `${t.id} -> ${r}`).toBeTruthy();
        expect(r).not.toBe(t.id);
      }
    }
  });

  it('cada tópico tem o ícone do registro de módulos (só quatro têm ícone próprio)', () => {
    const registryIcons = new Set(MODULES.map((m) => m.icon));
    for (const t of MANUAL_TOPICS) {
      if (OWN_ICON.includes(t.id)) {
        expect(t.module, t.id).toBeUndefined();
        expect(registryIcons.has(t.icon), `${t.id} repete o ícone de um módulo`).toBe(false);
      } else {
        expect(t.module, `${t.id} sem módulo`).toBeTruthy();
        expect(t.icon, t.id).toBe(moduleIcon(t.module!));
      }
    }
  });

  it('o título do tópico de módulo é o nome do registro, salvo os títulos próprios', () => {
    const own: Record<string, string> = { planner: 'Planejamento da sprint', painel: 'Painel e Squad' };
    for (const t of MANUAL_TOPICS) {
      if (!t.module) continue;
      if (own[t.id]) expect(t.title).toBe(own[t.id]);
      else expect(t.title, t.id).toBe(moduleLabel(t.module));
    }
  });

  it('"Atualizado em" está em todo tópico, no formato vX.Y.Z e sem passar da versão do portal', () => {
    const [mj, mn, pt] = packageInfo.version.split('.').map(Number);
    const cur = mj * 1e6 + mn * 1e3 + pt;
    for (const t of MANUAL_TOPICS) {
      expect(t.updatedIn, t.id).toMatch(/^v\d+\.\d+\.\d+$/);
      const [a, b, c] = t.updatedIn.slice(1).split('.').map(Number);
      expect(a * 1e6 + b * 1e3 + c, `${t.id} aponta para versão futura`).toBeLessThanOrEqual(cur);
    }
  });

  it('o tópico novo leva a etiqueta Novo', () => {
    for (const id of ['devtools', 'qualidade', 'action-plan', 'suporte', 'versoes', 'painel', 'admin']) expect(getTopicById(id)?.isNew, id).toBe(true);
  });

  it('todo tópico começa pela ideia central e tem ao menos uma seção', () => {
    for (const t of MANUAL_TOPICS) {
      const blocks = TOPIC_CONTENT[t.id];
      expect(blocks[0].kind, t.id).toBe('idea');
      expect(blocks.filter((b) => b.kind === 'idea')).toHaveLength(1);
      expect(blocks.some((b) => b.kind === 'h2'), t.id).toBe(true);
    }
  });

  it('a seção de API de módulo usa o catálogo e continua em Poker, Base, Prompt Hub e Painel e Squad', () => {
    const using = MANUAL_TOPICS.filter((t) => TOPIC_CONTENT[t.id].some((b) => b.kind === 'module-api')).map((t) => t.id);
    expect(using.sort()).toEqual(['knowledge', 'painel', 'poker', 'prompt-hub']);
    for (const t of MANUAL_TOPICS) {
      for (const b of TOPIC_CONTENT[t.id]) if (b.kind === 'module-api') expect(getModuleIntegration(b.moduleId), b.moduleId).toBeTruthy();
    }
  });

  it('anterior e próximo seguem a ordem do Manual, sem dar a volta', () => {
    expect(neighborsOf(MANUAL_TOPICS[0].id).prev).toBeUndefined();
    expect(neighborsOf(MANUAL_TOPICS[0].id).next?.id).toBe(MANUAL_TOPICS[1].id);
    expect(neighborsOf(MANUAL_TOPICS[MANUAL_TOPICS.length - 1].id).next).toBeUndefined();
  });

  it('apelidos antigos levam ao tópico certo', () => {
    expect(resolveTopicId('poker')).toBe('poker');
    expect(resolveTopicId('Plano')).toBe('action-plan');
    expect(resolveTopicId('seguranca')).toBe('governance');
    expect(resolveTopicId('integracoes')).toBe('integracoes');
    expect(resolveTopicId('nao-existe')).toBeUndefined();
  });
});

describe('manual: o que o texto não pode dizer', () => {
  const PROIBIDOS: Array<[string, RegExp]> = [
    ['"engenharia"', /engenharia/i],
    ['foguete', /rocket|foguete/i],
    ['"Google/OAuth"', /google\s*\/\s*oauth|oauth/i],
    ['jargão antigo', /Manual de Agilidade|Documenta[çc][ãa]o t[áa]tica|Guia de Opera[çc][õo]es|Manual de Opera[çc][õo]es|Integra[çc][ãa]o de M[áa]quina|Efeito Manada|riscos t[ée]cnicos|Alta Performance/i],
    ['nome antigo da Review', /Review de Sprint|Showcase de Sprint/],
    ['"em breve" no Planejamento', /\(em breve\)/i],
    ['armazenamento só no navegador para chaves', /residem apenas no armazenamento local/i],
    ['inventado antes', /LocalStorage|purga autom|por 30 dias/i],
  ];

  it.each(PROIBIDOS)('os textos dos tópicos não têm %s', (_nome, regra) => {
    expect(allText()).not.toMatch(regra);
  });

  it('o código do Manual (telas e dados) também não tem esses textos nem cores de paleta fixa nos tópicos', () => {
    const files = sources(manualDir);
    for (const f of files) {
      const code = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const [nome, regra] of PROIBIDOS.slice(0, 4)) expect(code, `${path.relative(manualDir, f)}: ${nome}`).not.toMatch(regra);
    }
    const topics = fs.readFileSync(path.join(manualDir, 'data', 'topics.ts'), 'utf8');
    expect(topics).not.toMatch(/heroBg|badgeBg|badgeBorder|badgeText|from-[a-z]+-\d|to-[a-z]+-\d/);
  });

  it('Scrum Poker fala de horas por papel e cópia da estimativa, sem prometer subtarefas no Jira', () => {
    const text = bodyText(TOPIC_CONTENT.poker);
    expect(text).toContain('Copiar estimativa');
    expect(text).toContain('(DEV 10h / QA 4h)');
    expect(text).toMatch(/issue pai/);
    expect(text).toMatch(/notas de DEV e QA/i);
    expect(text).toMatch(/não cria subtarefas/i);
    expect(text).not.toMatch(/(portal|sistema) (cria|gera|grava) subtarefas/i);
  });

  it('Segurança e dados tem os fatos corretos e leva à página /governance', () => {
    const t = getTopicById('governance')!;
    expect(t.title).toBe('Segurança e dados');
    expect(t.actionUrl).toBe('/governance');
    const text = bodyText(TOPIC_CONTENT.governance);
    expect(text).toMatch(/login próprio/);
    expect(text).toMatch(/JWT/);
    expect(text).toMatch(/renova sozinha/);
    expect(text).toMatch(/todos os aparelhos/);
    expect(text).toMatch(/cifrad[oa]s? no servidor/);
    expect(text).not.toMatch(/Google|OAuth/);
    expect(JSON.stringify(TOPIC_CONTENT.governance)).toContain('(/governance)');
  });

  it('Planejamento descreve o módulo ativo, com as quatro etapas', () => {
    const text = bodyText(TOPIC_CONTENT.planner);
    for (const etapa of ['Capacidade', 'Escopo', 'Distribuição', 'Revisar e enviar']) expect(text).toContain(etapa);
    expect(getTopicById('planner')?.actionLabel).not.toMatch(/breve/i);
  });

  it('Integrações e API usa os nomes reais das ferramentas MCP e dos endereços do backend', () => {
    const text = bodyText(TOPIC_CONTENT.integracoes);
    for (const nome of ['listDocuments', 'getDocument', 'importDocument', 'listPrompts', 'getPrompt', 'listPromptCollections', 'getPromptCollection', 'importSkill', 'batchImportSkills', 'getSquadStatus', 'listSquadMembers', 'listSquadIssues', 'createPokerSession', 'searchPokerEstimates']) {
      expect(text, nome).toContain(nome);
    }
    for (const rota of ['/api/v1/knowledge/docs', '/api/v1/prompt-hub/items', '/api/v1/poker/rounds', '/mcp/sse']) expect(text, rota).toContain(rota);
    for (const escopo of ['KNOWLEDGE_READ', 'KNOWLEDGE_WRITE', 'SQUAD_READ', 'PROMPTHUB_READ', 'PROMPTHUB_WRITE', 'POKER_READ', 'POKER_WRITE']) expect(text, escopo).toContain(escopo);
    expect(text).toContain('X-Api-Key');
    // Os exemplos ilustrativos do desenho não existem no backend.
    for (const inventado of ['listar_squads', 'buscar_artigos', 'estimar_issue', '/api/squads/{id}/sprint', '/api/poker/salas']) expect(text, inventado).not.toContain(inventado);
  });

  it('"Primeiros passos" usa a terminologia vigente: squad, convite, Jira, pedido de vínculo e nível de conta', () => {
    const topic = getTopicById('primeiros-passos')!;
    const text = bodyText(TOPIC_CONTENT['primeiros-passos']);
    expect(text).not.toMatch(/equipe/i);
    expect(`${topic.summary} ${topic.title}`).not.toMatch(/equipe/i);
    expect(text).toMatch(/pedido de vínculo/i);
    expect(text).toMatch(/convite/i);
    expect(text).toMatch(/importa[çc][ãa]o do Jira/i);
    expect(text).toMatch(/tela de espera/i);
    expect(text).toMatch(/Administrador e Membro/);
    expect(text).toMatch(/Agile Master, Product Owner ou People Lead/);
  });

  it('o Meu espaço descreve as seis abas reais', () => {
    const text = bodyText(TOPIC_CONTENT.workspace);
    for (const aba of ['Início', 'Kanban', 'Notas', 'Biblioteca', 'Histórico', 'Conta']) expect(text, aba).toContain(aba);
  });

  it('DevTools descreve os cinco grupos, o que sai do navegador e favoritas e recentes', () => {
    const text = bodyText(TOPIC_CONTENT.devtools);
    for (const g of ['Dados e formatos', 'Codificação e segurança', 'Texto e tempo', 'API e rede', 'Qualidade e testes']) expect(text, g).toContain(g);
    expect(text).toMatch(/Favoritas/);
    expect(text).toMatch(/Recentes/);
    expect(text).toMatch(/navegador/);
    expect(text).toMatch(/serviço/i);
  });
});
