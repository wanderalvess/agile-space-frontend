/**
 * jiraService.ts
 * Serviço centralizado de integração com o Jira.
 * Utilizado pelo Daily Timesheet, Scrum Poker e Sprint Showcase.
 */

import { authFetch } from '@/lib/auth-client';

export interface JiraIssue {
  key: string;
  title: string;
  description: string;
  type: string;
  status: string;
  statusCategory?: 'new' | 'indeterminate' | 'done' | 'unknown';
  priority: string;
  points: number;
  url: string;
  acceptanceCriteria: string;
  assignee?: string;
  assigneeId?: string; // accountId (Cloud) ou key (Server/DC) — chave estável pra agrupar por pessoa
  // Novos campos para automação do Showcase
  problem?: string;
  solution?: string;
  qa?: string;
  videoUrl?: string;
  devName?: string;
  timeSpent?: number;
  timeEstimate?: number; // estimativa ORIGINAL (aggregatetimeoriginalestimate/timeoriginalestimate)
  timeRemaining?: number; // estimativa RESTANTE (aggregatetimeestimate/timeestimate) — "tempo restante" no Jira
  planned?: { dev?: string; qa?: string; tu?: string };
  updated?: string;
  // `resolutiondate` do Jira — só muda uma vez, quando a issue resolve/fecha
  // (diferente de `updated`, que muda a qualquer edição). Ver inferSlip.
  resolutionDate?: string;
  dueDate?: string; // campo `duedate` do Jira, formato YYYY-MM-DD
  targetStart?: string;
  targetEnd?: string;
  // true = targetStart/targetEnd caiu no fallback (created/updated), não veio
  // de campo de data real do Jira. Ver comentário em fetchJiraIssues.
  datesAreInferred?: boolean;
  parentKey?: string; // chave da issue pai (história), quando esta issue é subtarefa
  parentTitle?: string;
  labels?: string[];
  worklogs?: any[];
  project?: string;
  versionMaster?: string;
  versionDevelop?: string;
  versionRelease?: string;
  // Valor bruto do campo Sprint (customfield_XXXXX) — só vem preenchido
  // quando fetchJiraIssues é chamado com opts.sprintFieldId (ID varia por
  // instância Jira, ver SquadConfig.sprintFieldId). Formato varia: array de
  // objetos (Jira Cloud) ou array de strings toString() estilo Greenhopper
  // (Jira Server/DC) — quem consome decide como parsear.
  sprintRaw?: unknown;
  subtaskKeys?: string[];
}

/**
 * Embeleza nomes de usuários do Jira (ex: wanderson.alves -> Wanderson Alves)
 */
const formatJiraName = (name: string): string => {
  if (!name) return '';
  return name
    .split(/[._\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Extrai métricas planejadas do título da issue (ex: Dev 13h / Q.A 10h)
 */
const parsePlannedFromTitle = (title: string) => {
  const planned: { dev?: string; qa?: string; tu?: string } = {};
  
  // Regex para achar padrões como "Dev 13h", "Q.A 10h", "TU 1h"
  const devMatch = title.match(/Dev\s*([\d,.]+h?)/i);
  const qaMatch = title.match(/Q\.?A\.?\s*([\d,.]+h?)/i);
  const tuMatch = title.match(/TU\s*([\d,.]+h?)/i);

  if (devMatch) planned.dev = devMatch[1].toLowerCase().endsWith('h') ? devMatch[1] : devMatch[1] + 'h';
  if (qaMatch) planned.qa = qaMatch[1].toLowerCase().endsWith('h') ? qaMatch[1] : qaMatch[1] + 'h';
  if (tuMatch) planned.tu = tuMatch[1].toLowerCase().endsWith('h') ? tuMatch[1] : tuMatch[1] + 'h';

  return Object.keys(planned).length > 0 ? planned : undefined;
};

/**
 * Extrai dados de CI/CD (Projeto e Versões) de um único texto/comentário
 */
const parseCicdFromText = (text: string) => {
  const info: { project?: string; versionMaster?: string; versionDevelop?: string; versionRelease?: string } = {};
  
  if (!text || !text.includes('Esteira de Integração Continua')) {
    return info;
  }

  const repoMatch = text.match(/Repositório:\s*([^\r\n]+)/i);
  if (repoMatch) {
    info.project = repoMatch[1].trim();
  }

  const versionMatch = text.match(/Versão:\s*([^\r\n]+)/i);
  const branchMatch = text.match(/Branch:\s*([^\r\n]+)/i);

  if (versionMatch && branchMatch) {
    const version = versionMatch[1].trim();
    const branch = branchMatch[1].trim().toLowerCase();

    if (branch.includes('master') || branch.includes('main')) {
      info.versionMaster = version;
    } else if (branch.includes('develop') || branch.includes('dev')) {
      info.versionDevelop = version;
    } else if (branch.includes('release')) {
      info.versionRelease = version;
    }
  }

  return info;
};

/**
 * Acumula os dados de CI/CD de múltiplos comentários
 */
const parseCicdFromComments = (comments: string[]) => {
  const result: { project?: string; versionMaster?: string; versionDevelop?: string; versionRelease?: string } = {};
  
  for (const comment of comments) {
    const parsed = parseCicdFromText(comment);
    if (parsed.project) result.project = parsed.project;
    if (parsed.versionMaster) result.versionMaster = parsed.versionMaster;
    if (parsed.versionDevelop) result.versionDevelop = parsed.versionDevelop;
    if (parsed.versionRelease) result.versionRelease = parsed.versionRelease;
  }
  
  return result;
};

/**
 * Extrai o primeiro link do Google Drive de um texto
 */
const extractDriveLink = (text: string): string => {
  const regex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
  const match = text.match(regex);
  return match ? match[0] : '';
};

/**
 * Remove marcação wiki do Jira — a API v2 devolve a description/comentário
 * como texto CRU nesse formato (não HTML), então sem isso a pontuação de
 * negrito/heading/cor sobra visível no meio do texto extraído
 * ("h3. *Descrição da Situação:*" em vez de "Descrição da Situação:").
 * O `*` de negrito ("*palavra*", sem espaço colado no `*`) é distinto do `*`
 * de marcador de lista ("* item", com espaço) — só o primeiro é removido.
 */
const stripWikiMarkup = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/^h[1-6]\.[ \t]*/gm, '')
    .replace(/\{color[^}]*\}([\s\S]*?)\{color\}/gi, '$1')
    .replace(/\{(?:quote|noformat|code[^}]*)\}([\s\S]*?)\{\/?(?:quote|noformat|code)\}/gi, '$1')
    .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '$1')
    .replace(/^-{3,}[ \t]*$/gm, '');
};

/**
 * Remove tags HTML, marcação wiki do Jira, e decodifica entidades de texto,
 * preservando quebra de linha (vira '\n' em vez de espaço) — os campos que
 * consomem isso no TaskCard são textarea multi-linha, então lista/bullet
 * colapsada numa linha só fica ilegível.
 */
const stripHtml = (html: string): string => {
  if (!html) return '';
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = stripWikiMarkup(text);
  const lines = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim());
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Extração tolerante de Problema/Solução/Critérios de Aceite. O time não
 * escreve religiosamente com esses cabeçalhos — varia sinônimo, ordem,
 * emoji/negrito na frente do título ("📝 Contexto", "*Solução:*"), ou não usa
 * cabeçalho nenhum — então em vez de regex rígido por campo, isto localiza
 * QUALQUER cabeçalho conhecido (de qualquer categoria) pra servir de fim de
 * seção, independente da ordem em que apareçam no texto.
 */
const SECTION_ALIASES = {
  problem: [
    'PROBLEMA', 'CONTEXTO', 'MOTIVA[ÇC][ÃA]O', 'POR\\s+QU[ÊE]', 'ERRO\\s+ENCONTRADO',
    // "CENÁRIO" sozinho fica de fora: palavra comum demais — aparece solta
    // em item de lista ("1. Cenário: X") e não só em header de seção real.
    // "Cenário" como problema sem header dedicado ainda cai no fallback do
    // preâmbulo (guessProblemFromPreamble).
  ],
  solution: [
    'SOLU[ÇC][ÃA]O', 'RESOLU[ÇC][ÃA]O', 'AN[ÁA]LISE',
    'O\\s+QUE\\s+FOI\\s+FEITO', 'COMO\\s+FOI\\s+FEITO', 'IMPLEMENTA[ÇC][ÃA]O',
    'ALTERA[ÇC][ÕO]ES?\\s+REALIZADAS?', 'PROPOSTA\\s+(?:DE\\s+)?SOLU[ÇC][ÃA]O',
    // Histórias de usuário formais (sem bug report por trás) descrevem "a
    // solução" com esses títulos em vez de "Solução" mesmo.
    'DETALHAMENTO\\s+FUNCIONAL', 'OBJETIVO\\s+DA\\s+MUDAN[ÇC]A', 'IMPACTOS?\\s+T[ÉE]CNICOS?',
    // "CORREÇÃO" sozinho NÃO entra: bate com títulos de seção-container tipo
    // "Correção/Alteração Efetuada na Rotina" (template real visto em
    // produção) antes de achar o "Solução" de verdade lá dentro.
  ],
  acceptanceCriteria: [
    'CRIT[ÉE]RIOS?\\s+DE\\s+ACEITE', 'CRIT[ÉE]RIOS?\\s+DE\\s+ACEITA[ÇC][ÃA]O',
    'ACCEPTANCE\\s+CRITERIA', 'O\\s+QUE\\s+SER[ÁA]\\s+TESTADO',
    'CEN[ÁA]RIOS?\\s+DE\\s+TESTE', 'COMPORTAMENTO\\s+ESPERADO',
    'ROTEIRO\\s+DE\\s+TESTES?', 'CHECKLIST',
  ],
  // Só servem de delimitador de fim de seção — não viram nenhum dos 3 campos,
  // mas sem eles na lista o conteúdo deles é engolido pela seção anterior
  // (ex.: "Pontos de Atenção" grudado no fim dos Critérios de Aceite).
  other: [
    'PONTOS?\\s+DE\\s+ATEN[ÇC][ÃA]O', 'DOCUMENTA[ÇC][ÃA]O(?:\\s+E\\s+EVID[ÊE]NCIAS)?',
    'DADOS\\s+T[ÉE]CNICOS(?:\\s+E\\s+LINKS)?', 'V[ÍI]DEO', 'EVID[ÊE]NCIAS?',
    // Seções fixas de um template de ticket real (TOTVS) — não são nenhum
    // dos 3 campos, só cabeçalho de container; sem eles entram como conteúdo
    // do Problema/Solução/Critério da seção anterior.
    'ROTINA', 'VERS[ÃA]O\\s+PARA\\s+TESTE', 'TABELAS\\s+UTILIZADAS',
    'NECESSITA\\s+DE\\s+PERMISS[ÃA]O(?:\\s+OU\\s+PARAMETRIZA[ÇC][ÃA]O)?(?:\\?\\s*QUAIS\\?)?',
    'CEN[ÁA]RIOS?\\s+A\\s+SEREM\\s+TESTADOS',
  ],
};

const ALL_ALIASES = [
  ...SECTION_ALIASES.problem, ...SECTION_ALIASES.solution,
  ...SECTION_ALIASES.acceptanceCriteria, ...SECTION_ALIASES.other,
];

// Pula opcionalmente "h1."-"h6." (heading de wiki markup do Jira — começa
// com letra, não é "símbolo" pro skip abaixo) e depois até 8 caracteres
// não-letra (emoji, *, #, número, espaço) antes do cabeçalho — cobre
// "📝 Contexto", "🛠 Alterações Realizadas", "*Solução:*", "h2. Solução".
const HEADER_LEAD = '^(?:h[1-6]\\.[ \\t]*)?[^\\p{L}\\n]{0,8}';
// Cabeçalhos colados tipo "Contexto/Problema" viram um cabeçalho só (senão a
// busca pelo fim da 1ª seção acha o 2º alias colado e zera o conteúdo).
const HEADER_GLUE = `(?:\\s*[\\/,]\\s*(?:${ALL_ALIASES.join('|')}))*`;
// A palavra extra tolerada ("Problema Atual", "Critério Geral") só conta se
// vier seguida de quebra de linha (lookahead, não consome) — sem essa
// âncora, "Problema Identificou-se uma falha..." (frase corrida colada no
// cabeçalho) comia a primeira palavra da frase como se fosse qualificador.
const HEADER_TAIL = '(?:[ \\t]+\\p{L}{2,20}(?=[ \\t]*(?:\\n|$)))?(?:\\s*\\([^)]{0,40}\\))?[ \\t]*:?[ \\t]*\\n?';

const findHeader = (text: string, aliases: string[]): RegExpMatchArray | null => {
  const re = new RegExp(`${HEADER_LEAD}(?:${aliases.join('|')})${HEADER_GLUE}${HEADER_TAIL}`, 'imu');
  return text.match(re);
};

// Junta TODAS as ocorrências da mesma categoria (ex.: "Cenários de Teste" e
// "Comportamento Esperado" são as duas Critérios de Aceite) em vez de só a
// primeira — senão a segunda seção do mesmo tipo se perde.
const extractSection = (text: string, aliases: string[]): string => {
  const parts: string[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const rest = text.slice(searchFrom);
    const startMatch = findHeader(rest, aliases);
    if (!startMatch || startMatch.index === undefined) break;
    const absStart = searchFrom + startMatch.index;
    const afterStart = absStart + startMatch[0].length;
    const endMatch = findHeader(text.slice(afterStart), ALL_ALIASES);
    const absEnd = endMatch && endMatch.index !== undefined ? afterStart + endMatch.index : text.length;
    parts.push(text.slice(afterStart, absEnd));
    searchFrom = absEnd;
  }
  return stripHtml(parts.join('\n\n'));
};

const GHERKIN_LINE = /^\s*(?:dado|given|quando|when|ent[ãa]o|then)\b/i;
const BULLET_LINE = /^\s*(?:[-*•#]|\d+[.)]|\[[ xX]\])\s+/;

// Tira spans já reconhecidos por outro campo (Problema, Solução, "other" —
// Dados Técnicos, Documentação, Pontos de Atenção...) antes de varrer por
// bullets soltos — senão uma lista de links vira "Critério de Aceite" só
// por ter marcador de lista, ou um bullet que já virou Solução (via
// "Objetivo da Mudança"/"Detalhamento Funcional" etc.) aparece duplicado
// como Critério de Aceite também.
const stripKnownSections = (text: string, aliases: string[]): string => {
  let result = text;
  let searchFrom = 0;
  const spans: Array<[number, number]> = [];
  while (searchFrom < result.length) {
    const rest = result.slice(searchFrom);
    const m = findHeader(rest, aliases);
    if (!m || m.index === undefined) break;
    const absStart = searchFrom + m.index;
    const afterHeader = absStart + m[0].length;
    const endM = findHeader(result.slice(afterHeader), ALL_ALIASES);
    const absEnd = endM && endM.index !== undefined ? afterHeader + endM.index : result.length;
    spans.push([absStart, absEnd]);
    searchFrom = absEnd;
  }
  for (let i = spans.length - 1; i >= 0; i--) {
    result = result.slice(0, spans[i][0]) + result.slice(spans[i][1]);
  }
  return result;
};

/** Sem cabeçalho de critério: procura um bloco de linhas em Gherkin ou lista com marcador. */
const guessAcceptanceCriteria = (text: string): string => {
  const claimed = [...SECTION_ALIASES.other, ...SECTION_ALIASES.problem, ...SECTION_ALIASES.solution];
  const lines = stripHtml(stripKnownSections(text, claimed)).split('\n');
  const hits = lines.filter(l => GHERKIN_LINE.test(l) || BULLET_LINE.test(l));
  return hits.join('\n');
};

const parseAcceptanceCriteriaFromDescription = (desc: string) => {
  if (!desc) return '';
  return extractSection(desc, SECTION_ALIASES.acceptanceCriteria) || guessAcceptanceCriteria(desc);
};

const parseProblemFromDescription = (desc: string) => {
  if (!desc) return '';
  return extractSection(desc, SECTION_ALIASES.problem);
};

const parseSolutionFromDescription = (desc: string) => {
  if (!desc) return '';
  return extractSection(desc, SECTION_ALIASES.solution);
};

/**
 * Último recurso pro Problema: sem cabeçalho dedicado, usa o preâmbulo — tudo
 * antes do primeiro cabeçalho conhecido, de qualquer categoria. Cobre abrir a
 * descrição direto com o contexto, sem rotular nada; sem cabeçalho NENHUM no
 * texto, o preâmbulo é o texto inteiro. Chamado à parte (não embutido nos
 * parse*FromDescription) pra não atropelar quem tenta uma fonte (comentário)
 * e cai pra outra (descrição) antes de aceitar o preâmbulo como resposta.
 */
const guessProblemFromPreamble = (text: string): string => {
  if (!text) return '';
  const firstHeader = findHeader(text, ALL_ALIASES);
  const preamble = firstHeader && firstHeader.index !== undefined ? text.slice(0, firstHeader.index) : text;
  return stripHtml(preamble);
};

const parseQAFromDescription = (desc: string) => {
  if (!desc) return '';
  const qaMatch = desc.match(/(?:QA|Q\.A\.?):?\s*([^\n|]+)/i);
  return qaMatch ? formatJiraName(qaMatch[1].trim()) : '';
};

/**
 * Parseia um arquivo XML exportado do Jira e retorna uma lista de tarefas.
 */
export const parseJiraXml = (xmlText: string): JiraIssue[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('⚠️ Arquivo XML inválido. Verifique se foi exportado corretamente pelo Jira.');
  }

  const channelLink = xmlDoc.querySelector('channel > link');
  const baseUrl = channelLink?.textContent?.replace(/\/+$/, '') || '';

  const items = xmlDoc.querySelectorAll('channel > item');
  if (items.length > 0) {
    const issues: JiraIssue[] = [];
    const seen = new Set<string>();

    Array.from(items).forEach((item) => {
      const key = item.querySelector('key')?.textContent?.trim() || '';
      if (!key || seen.has(key)) return;
      seen.add(key);

      const summary = item.querySelector('summary')?.textContent?.trim() || key;
      const description = item.querySelector('description')?.textContent?.trim() || '';
      const type = item.querySelector('type')?.textContent?.trim() || 'Task';
      const status = item.querySelector('status')?.textContent?.trim() || 'To Do';
      const priority = item.querySelector('priority')?.textContent?.trim() || 'Medium';
      const link = item.querySelector('link')?.textContent?.trim() || `${baseUrl}/browse/${key}`;
      const assigneeText = item.querySelector('assignee')?.textContent?.trim() || '';
      const assignee = formatJiraName(assigneeText);

      // --- AUTOMAÇÃO SHOWCASE ---
      let devName = assignee;
      let devUsername = item.querySelector('assignee')?.getAttribute('username') || '';
      let qa = '';
      let problem = '';
      let solution = '';
      let videoUrl = '';
      let acceptanceCriteria = '';
      let timeSpent = 0;
      let timeEstimate = 0;
      const planned = parsePlannedFromTitle(summary);

      // Pegar métricas de tempo (Aggregate)
      const aggSpent = item.querySelector('aggregatetimespent')?.getAttribute('seconds');
      const aggEst = item.querySelector('aggregatetimeoriginalestimate')?.getAttribute('seconds');
      
      if (aggSpent) timeSpent = parseInt(aggSpent, 10);
      if (aggEst) timeEstimate = parseInt(aggEst, 10);

      // Fallback para campos individuais se não houver aggregate
      if (!timeSpent) {
        const indSpent = item.querySelector('timespent')?.getAttribute('seconds');
        if (indSpent) timeSpent = parseInt(indSpent, 10);
      }
      if (!timeEstimate) {
        const indEst = item.querySelector('timeoriginalestimate')?.getAttribute('seconds');
        if (indEst) timeEstimate = parseInt(indEst, 10);
      }

      // Tenta pegar o Dev Real de customfield_10046 (Jira Custom Field)
      item.querySelectorAll('customfield').forEach((cf) => {
        const cfId = cf.getAttribute('id');
        const cfName = cf.querySelector('customfieldname')?.textContent?.toLowerCase() || '';
        const cfValue = cf.querySelector('customfieldvalue')?.textContent?.trim() || '';

        if (cfId === 'customfield_10046' || cfName.includes('desenvolvedor')) {
          devName = formatJiraName(cfValue);
          devUsername = cf.querySelector('customfieldvalue')?.getAttribute('username') || cfValue;
        }
        if (cfId === 'customfield_25307' || cfName.includes('aceitação') || cfName.includes('qa')) {
          qa = formatJiraName(cfValue);
        }
        // Campo específico de Critérios (se existir como custom field dedicado)
        if (cfId === 'customfield_10100' || cfName === 'critérios de aceite') {
          acceptanceCriteria = cfValue;
        }
      });

      // Varrer COMENTÁRIOS para achar Problema, Solução e Vídeos
      const comments = Array.from(item.querySelectorAll('comment')).map(c => ({
        author: c.getAttribute('author') || '',
        text: c.textContent?.trim() || ''
      }));

      // Comentários do DEV entram primeiro no texto combinado (prioridade
      // sem descartar o resto) — se o mesmo cabeçalho aparecer em dois
      // lugares, o parser pega a primeira ocorrência.
      const devComments = comments.filter(c => c.author === devUsername).map(c => c.text);
      const otherComments = comments.filter(c => c.author !== devUsername).map(c => c.text);
      const combinedText = [...devComments, description, ...otherComments].filter(Boolean).join('\n\n');

      videoUrl = extractDriveLink(combinedText);

      if (!acceptanceCriteria) acceptanceCriteria = parseAcceptanceCriteriaFromDescription(combinedText);
      problem = parseProblemFromDescription(combinedText);
      solution = parseSolutionFromDescription(combinedText);

      // Fallback para campo específico se não achar solução no texto
      if (!solution) {
        item.querySelectorAll('customfield').forEach(cf => {
          if (cf.getAttribute('id') === 'customfield_10410') {
            const raw = cf.querySelector('customfieldvalue')?.textContent || '';
            const match = raw.match(/Solução:([\s\S]*)/i);
            solution = match ? match[1].trim() : raw.trim();
          }
        });
      }

      // Sem cabeçalho de Problema achado: usa o preâmbulo do texto combinado
      // pra não perder a informação deixando o campo em branco.
      if (!problem) problem = guessProblemFromPreamble(combinedText);

      // Story points
      let points = 0;
      item.querySelectorAll('customfield').forEach((cf) => {
        const cfName = cf.querySelector('customfieldname')?.textContent?.toLowerCase() || '';
        if (cfName.includes('story point') || cfName.includes('pontos') || cfName.includes('estimate')) {
          const val = parseFloat(cf.querySelector('customfieldvalue')?.textContent || '0');
          if (!isNaN(val)) points = val;
        }
      });

      // Extrair informações do CI/CD dos comentários
      const cicdInfo = parseCicdFromComments(comments.map(c => c.text));

      issues.push({ 
        key, title: summary, description, type, status, priority, 
        points, url: link, acceptanceCriteria, assignee,
        problem, solution, qa, videoUrl, devName,
        timeSpent, timeEstimate, planned,
        project: cicdInfo.project,
        versionMaster: cicdInfo.versionMaster,
        versionDevelop: cicdInfo.versionDevelop,
        versionRelease: cicdInfo.versionRelease
      });

      // Se for issue de Gestão (ex: Refinamento), extrair issues associadas do issuelinks
      if (type.toLowerCase().includes('gest')) {
        const linkedKeysNodes = item.querySelectorAll('issuelinks issuekey');
        linkedKeysNodes.forEach((node) => {
          const linkedKey = node.textContent?.trim();
          if (linkedKey && !seen.has(linkedKey)) {
            seen.add(linkedKey);
            issues.push({
              key: linkedKey,
              title: linkedKey,
              description: `Tarefa extraída do grupo de Refinamento ${key}`,
              type: 'Task',
              status: 'To Do',
              priority: 'Medium',
              url: `${baseUrl}/browse/${linkedKey}`,
              acceptanceCriteria: '',
              points: 0,
              assignee: '',
              problem: '',
              solution: '',
              qa: '',
              videoUrl: '',
              devName: '',
              timeSpent: 0,
              timeEstimate: 0,
              planned: undefined,
              project: '',
              versionMaster: '',
              versionDevelop: '',
              versionRelease: ''
            });
          }
        });
      }
    });

    if (issues.length > 0) return issues;
  }

  // Fallback para issuelinks (mantido)
  const linkedKeysNodes = xmlDoc.querySelectorAll('issuelinks issuekey');
  const uniqueKeys = new Set<string>();
  const fallbackIssues: JiraIssue[] = [];

  Array.from(linkedKeysNodes).forEach((node) => {
    const key = node.textContent?.trim();
    if (key && !uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      fallbackIssues.push({
        key, title: key, description: '...', type: 'Task',
        status: 'To Do', priority: 'Medium', points: 0,
        url: `${baseUrl}/browse/${key}`, acceptanceCriteria: '',
      });
    }
  });

  return fallbackIssues;
};

/**
 * Extrai texto plano de uma descrição do Jira, que pode vir como string
 * simples (Jira Server/Data Center) ou como documento ADF - Atlassian
 * Document Format (Jira Cloud v3): { type: 'doc', content: [...] }.
 */
const extractPlainTextFromDescription = (desc: unknown): string => {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object') {
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(desc);
    return parts.join(' ');
  }
  return '';
};

export interface JiraFieldMeta {
  id: string;
  name: string;
  schema?: { custom?: string; type?: string };
}

/**
 * Lista os campos do Jira (/rest/api/2/field via backend) e resolve o ID do
 * customfield "Sprint" (schema.custom = gh-sprint, com fallback por nome) —
 * esse ID varia por instância/projeto Jira, então não pode ficar hardcoded
 * (ver UNMAPPED_SPRINT_ID em useSquadStore.ts). Retorna null se não achar ou
 * se a chamada falhar — quem chama deve manter o comportamento de fallback
 * atual nesse caso, sem quebrar o sync.
 */
export const resolveSprintFieldId = async (domain: string, token: string): Promise<string | null> => {
  try {
    const res = await authFetch('/api/jira/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.trim(), token: token.trim() }),
    });
    if (!res.ok) return null;
    const fields: JiraFieldMeta[] = await res.json();
    if (!Array.isArray(fields)) return null;
    const byType = fields.find(f => f.schema?.custom === 'com.pyxis.greenhopper.jira:gh-sprint');
    if (byType) return byType.id;
    const byName = fields.find(f => f.name?.trim().toLowerCase() === 'sprint');
    return byName?.id || null;
  } catch {
    return null;
  }
};

export interface JiraSprintInfo {
  id: string;
  name: string;
  state: string;
  startDate: string;
  endDate: string;
}

/**
 * Busca metadados oficiais de uma sprint (/rest/agile/1.0/sprint/{id} via
 * backend) — nome/estado/datas direto do Jira, não o blob embutido no
 * customfield Sprint das issues (Server/DC serializa como toString() Java,
 * sujeito a truncar nome com vírgula em parseSprintField). Retorna null em
 * qualquer falha — quem chama deve manter os valores já parseados da issue
 * como fallback nesse caso.
 */
export const fetchSprintInfo = async (domain: string, token: string, sprintId: string): Promise<JiraSprintInfo | null> => {
  try {
    const res = await authFetch('/api/jira/sprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.trim(), token: token.trim(), sprintId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id) return null;
    return {
      id: String(data.id),
      name: data.name || '',
      state: data.state || '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
    };
  } catch {
    return null;
  }
};

/**
 * Busca issues no Jira via API REST (Atualizado para trazer campos de evidência)
 */
export const fetchJiraIssues = async (
  domain: string, token: string, jql: string,
  opts?: { maxResults?: number; startAt?: number; fields?: string[]; sprintFieldId?: string }
): Promise<{ issues: JiraIssue[]; total: number }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await authFetch('/api/jira/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: domain.trim(), token: token.trim(), jql: jql.trim(),
        ...(opts?.maxResults ? { maxResults: opts.maxResults } : {}),
        ...(opts?.startAt ? { startAt: opts.startAt } : {}),
        ...(opts?.fields ? { fields: opts.fields } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao consultar o Jira. Verifique a conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errorMessage = `Erro na API Jira: ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // ignora caso não seja json
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const issues: JiraIssue[] = (data.issues || []).map((issue: any) => {
    const fields = issue.fields || {};
    // Texto puro (ADF achatado ou string wiki-markup crua) — é o formato que
    // as extrações via regex abaixo (problema/solução/critérios/QA/vídeo)
    // esperam, então continua sendo usado exclusivamente por elas.
    const desc = extractPlainTextFromDescription(fields.description);

    // `renderedFields.description` (via ?expand=renderedFields em route.ts) é
    // HTML já pronto do próprio Jira, com toda a formatação preservada
    // (negrito, headings, listas, links) — ao contrário de `fields.description`,
    // que na v2 é wiki markup cru e vira texto achatado em `desc`. Usamos esse
    // HTML apenas no campo `description` exibido na sala; caso a API não
    // devolva renderedFields (ex.: PAT sem permissão), cai para `desc` como
    // antes — issues já importadas no Firestore continuam renderizando bem
    // via fallback de texto puro do IssueDetail.
    const renderedDescription = issue.renderedFields?.description;
    const richDescription = typeof renderedDescription === 'string' && renderedDescription.trim()
      ? renderedDescription
      : desc;

    // Tenta extrair pontos (Story Points)
    let points = 0;
    const possiblePointFields = [
      'customfield_10016', // Story Points (Jira Cloud Default)
      'customfield_10002', // Story Points
      'customfield_10004', // Story Points
    ];
    
    for (const fieldId of possiblePointFields) {
      if (fields[fieldId]) {
        points = parseFloat(fields[fieldId]) || 0;
        if (points > 0) break;
      }
    }

    // Se ainda não achou, varre todos os campos em busca de "point" ou "estimate"
    if (points === 0) {
      Object.keys(fields).forEach(key => {
        if (key.startsWith('customfield_') && (key.toLowerCase().includes('point') || key.toLowerCase().includes('estimate'))) {
          const val = parseFloat(fields[key]);
          if (!isNaN(val) && val > 0) points = val;
        }
      });
    }

    // Fallback final: Tenta achar no texto da descrição (ex: [3 pts], (5 pts))
    if (points === 0 && desc) {
      const pointMatch = desc.match(/[\[\(\s](\d+(?:\.\d+)?)\s*(?:pts?|pontos|story points)[\]\)\s]/i);
      if (pointMatch) points = parseFloat(pointMatch[1]);
    }

    const commentsObj = fields?.comment;
    const commentsList: string[] = Array.isArray(commentsObj?.comments)
      ? commentsObj.comments.map((c: any) => c.body || '')
      : [];
    const cicdParsed = parseCicdFromComments(commentsList);
    // Problema/solução raramente estão na descrição — ficam no comentário
    // (geralmente de quem desenvolveu) — por isso comentário é fonte
    // primária aqui, descrição só como fallback.
    const commentsText = commentsList.join(' ');

    const toSafeString = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object') {
        if (typeof val.value === 'string') return val.value;
        if (typeof val.name === 'string') return val.name;
        if (typeof val.key === 'string') return val.key;
        if (typeof val.id === 'string' || typeof val.id === 'number') return String(val.id);
        return '';
      }
      return '';
    };

    // Data REAL de planejamento (campo que alguém preencheu de propósito no
    // Jira) vs. fallback fabricado (created/updated, timestamp de auditoria,
    // não data de plano). datesAreInferred avisa quem consome que a fase caiu
    // no fallback — sem isso, uma cascata de atraso calcula em cima de uma
    // data inventada sem avisar ninguém (ver Jira Plans / SquadPlansTimeline).
    const realTargetStart = toSafeString(fields?.customfield_10015) || toSafeString(fields?.startDate) || toSafeString(fields?.target_start);
    const realTargetEnd = toSafeString(fields?.customfield_10014) || toSafeString(fields?.duedate) || toSafeString(fields?.target_end);

    return {
      key: issue.key,
      title: fields?.summary || issue.key,
      url: issue.link || `https://${domain}/browse/${issue.key}`,
      description: richDescription,
      type: fields?.issuetype?.name || '',
      status: fields?.status?.name || '',
      statusCategory: (fields?.status?.statusCategory?.key as JiraIssue['statusCategory']) || 'unknown',
      priority: fields?.priority?.name || '',
      assignee: fields?.assignee?.displayName || '',
      assigneeId: fields?.assignee?.accountId || fields?.assignee?.key || '',
      updated: toSafeString(fields?.updated),
      resolutionDate: toSafeString(fields?.resolutiondate),
      dueDate: toSafeString(fields?.duedate),
      targetStart: realTargetStart || (typeof fields?.created === 'string' ? fields.created.substring(0, 10) : ''),
      targetEnd: realTargetEnd || (typeof fields?.updated === 'string' ? fields.updated.substring(0, 10) : ''),
      datesAreInferred: !realTargetStart || !realTargetEnd,
      parentKey: toSafeString(fields?.parent?.key || (typeof fields?.parent === 'string' ? fields.parent : '')),
      parentTitle: toSafeString(fields?.parent?.fields?.summary),
      subtaskKeys: Array.isArray(fields?.subtasks)
        ? fields.subtasks.map((st: any) => toSafeString(st?.key)).filter(Boolean)
        : undefined,
      labels: fields?.labels || [],
      points,
      planned: parsePlannedFromTitle(fields?.summary || ''),
      acceptanceCriteria: fields?.customfield_10100 || parseAcceptanceCriteriaFromDescription(desc),
      problem: parseProblemFromDescription(commentsText) || parseProblemFromDescription(desc) || guessProblemFromPreamble(desc),
      solution: parseSolutionFromDescription(commentsText) || parseSolutionFromDescription(desc),
      qa: formatJiraName(fields?.customfield_25307?.displayName || fields?.customfield_25307 || '') || parseQAFromDescription(desc),
      videoUrl: extractDriveLink(commentsText) || extractDriveLink(desc),
      devName: formatJiraName(fields?.customfield_10046?.displayName || fields?.assignee?.displayName || ''),
      timeSpent: fields?.aggregatetimespent || fields?.timespent || 0,
      timeEstimate: fields?.aggregatetimeoriginalestimate || fields?.timeoriginalestimate || 0,
      timeRemaining: fields?.aggregatetimeestimate || fields?.timeestimate || 0,
      worklogs: fields?.worklog?.worklogs || [],
      project: cicdParsed.project,
      versionMaster: cicdParsed.versionMaster,
      versionDevelop: cicdParsed.versionDevelop,
      versionRelease: cicdParsed.versionRelease,
      sprintRaw: (() => {
        if (opts?.sprintFieldId && fields?.[opts.sprintFieldId]) return fields[opts.sprintFieldId];
        if (!fields) return undefined;
        const candidateFields = [
          'customfield_10005', 'customfield_10008', 'customfield_10007',
          'customfield_10010', 'customfield_10020', 'customfield_10016',
          'customfield_10100', 'customfield_10101', 'customfield_10004', 'sprint'
        ];
        for (const f of candidateFields) {
          if (fields[f]) {
            const val = fields[f];
            if (Array.isArray(val) && val.length > 0) {
              const first = val[0];
              if (typeof first === 'string' && (first.includes('com.atlassian.greenhopper.service.sprint.Sprint') || first.includes('state='))) return val;
              if (typeof first === 'object' && first !== null && ('startDate' in first || 'state' in first || 'name' in first)) return val;
            }
          }
        }
        for (const key of Object.keys(fields)) {
          const val = fields[key];
          if (Array.isArray(val) && val.length > 0) {
            const first = val[0];
            if (typeof first === 'string' && (first.includes('com.atlassian.greenhopper.service.sprint.Sprint') || (first.includes('[id=') && first.includes('startDate=')))) return val;
            if (typeof first === 'object' && first !== null && ('startDate' in first || ('state' in first && 'name' in first))) return val;
          }
        }
        return undefined;
      })(),
    };
  });

  return { issues, total: data.total || issues.length };
};

/**
 * Igual a fetchJiraIssues, mas pagina até trazer o total (a rota /api/jira/search
 * trava maxResults em 100 por chamada). Sem isso, um sync de squad com mais de
 * 100 issues na sprint truncava silenciosamente — usado pelo sync do Squad Pulse,
 * não pelo import pessoal (que continua limitado a uma página por design).
 */
export const fetchAllJiraIssues = async (
  domain: string, token: string, jql: string,
  opts?: { pageSize?: number; maxPages?: number; fields?: string[]; sprintFieldId?: string }
): Promise<{ issues: JiraIssue[]; total: number; truncated: boolean }> => {
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 20; // teto de segurança: 2000 issues

  const allIssues: JiraIssue[] = [];
  let total = Infinity;
  let startAt = 0;
  let page = 0;

  while (allIssues.length < total && page < maxPages) {
    const { issues, total: pageTotal } = await fetchJiraIssues(domain, token, jql, { maxResults: pageSize, startAt, fields: opts?.fields, sprintFieldId: opts?.sprintFieldId });
    total = pageTotal;
    if (issues.length === 0) break; // segurança: evita loop infinito se a API devolver total incorreto
    allIssues.push(...issues);
    startAt += issues.length;
    page += 1;
  }

  // truncated=true quando o teto de páginas foi atingido com issues ainda por
  // buscar — sem esse sinal, um squad com >2000 issues no escopo perdia issues
  // silenciosamente, sem aviso em lugar nenhum (nem log, nem lastSyncError).
  const truncated = allIssues.length < total && page >= maxPages;
  return { issues: allIssues, total, truncated };
};

/**
 * Preenche problema/solução/vídeo a partir de subtarefas (ex: "Codificação", "Desenvolvimento",
 * "Sub-task", etc.) quando a issue principal não trouxe essa informação.
 * NÃO força issuetype = "Codificação" na JQL porque o nome da issue type de subtarefa
 * varia entre projetos/instâncias do Jira (e gerava erro 400 "O valor 'Codificação' não existe para o campo 'issuetype'").
 * parent in (...) já filtra diretamente e exclusivamente as subtarefas dessas issues pai.
 */
export const enrichWithCodificacaoChildren = async (
  domain: string, token: string, issues: JiraIssue[]
): Promise<JiraIssue[]> => {
  const pending = issues.filter(i => {
    if (i.problem && i.solution) return false;
    // Se mapeamos as subtarefas da issue e sabemos que ela tem 0 subtarefas, podemos pular
    if (Array.isArray(i.subtaskKeys) && i.subtaskKeys.length === 0) return false;
    return true;
  });
  if (pending.length === 0) return issues;

  const childrenByParent = new Map<string, JiraIssue[]>();
  // 30 chaves por chamada mantém a URL da GET /search em tamanho seguro
  for (let i = 0; i < pending.length; i += 30) {
    const chunkKeys = pending.slice(i, i + 30).map(p => p.key);
    const jql = `parent in (${chunkKeys.join(',')})`;
    try {
      const { issues: children } = await fetchJiraIssues(domain, token, jql, { maxResults: 100 });
      children.forEach(child => {
        if (child.parentKey) {
          const list = childrenByParent.get(child.parentKey) || [];
          list.push(child);
          childrenByParent.set(child.parentKey, list);
        }
      });
    } catch (e) {
      // Uma falha pontual nessa busca extra não derruba a importação
      console.warn('[enrichWithCodificacaoChildren] Falha ao buscar subtarefas:', e);
    }
  }

  if (childrenByParent.size === 0) return issues;

  const isDevSubtask = (child: JiraIssue) => {
    const text = `${child.type || ''} ${child.title || ''}`.toLowerCase();
    return text.includes('codifica') || text.includes('desenvolv') || text.includes('dev') || text.includes('coding');
  };

  return issues.map(issue => {
    const subtasks = childrenByParent.get(issue.key);
    if (!subtasks || subtasks.length === 0) return issue;

    // Prioriza subtarefas de codificação/desenvolvimento que possuam solução ou problema
    const sortedSubtasks = [...subtasks].sort((a, b) => {
      const scoreA = (isDevSubtask(a) ? 10 : 0) + (a.solution ? 5 : 0) + (a.problem ? 3 : 0) + (a.videoUrl ? 2 : 0);
      const scoreB = (isDevSubtask(b) ? 10 : 0) + (b.solution ? 5 : 0) + (b.problem ? 3 : 0) + (b.videoUrl ? 2 : 0);
      return scoreB - scoreA;
    });

    const bestSubtask = sortedSubtasks[0];
    const anyWithProblem = sortedSubtasks.find(s => s.problem);
    const anyWithSolution = sortedSubtasks.find(s => s.solution);
    const anyWithVideo = sortedSubtasks.find(s => s.videoUrl);
    const anyWithProject = sortedSubtasks.find(s => s.project);
    const anyWithQA = sortedSubtasks.find(s => s.qa);
    const anyWithDev = sortedSubtasks.find(s => s.devName);

    return {
      ...issue,
      problem: issue.problem || bestSubtask?.problem || anyWithProblem?.problem,
      solution: issue.solution || bestSubtask?.solution || anyWithSolution?.solution,
      videoUrl: issue.videoUrl || bestSubtask?.videoUrl || anyWithVideo?.videoUrl,
      project: issue.project || bestSubtask?.project || anyWithProject?.project,
      versionMaster: issue.versionMaster || bestSubtask?.versionMaster || anyWithProject?.versionMaster,
      versionDevelop: issue.versionDevelop || bestSubtask?.versionDevelop || anyWithProject?.versionDevelop,
      versionRelease: issue.versionRelease || bestSubtask?.versionRelease || anyWithProject?.versionRelease,
      qa: issue.qa || anyWithQA?.qa,
      devName: issue.devName || (bestSubtask?.devName && isDevSubtask(bestSubtask) ? bestSubtask.devName : anyWithDev?.devName),
    };
  });
};

/**
 * Caminho inverso do enrichWithCodificacaoChildren: quando a subtarefa (ex.:
 * "Codificação") é ela mesma a issue importada — não a história pai — o
 * contexto (problema/critérios) geralmente está descrito na história, não
 * repetido na subtarefa. Sem isso, importar a subtarefa direto (em vez da
 * história) trazia o card sem problema/critério nenhum, mesmo a história pai
 * tendo tudo isso preenchido.
 */
export const enrichWithParentContext = async (
  domain: string, token: string, issues: JiraIssue[]
): Promise<JiraIssue[]> => {
  const pending = issues.filter(i => i.parentKey && (!i.problem || !i.solution || !i.acceptanceCriteria));
  if (pending.length === 0) return issues;

  const parentKeys = Array.from(new Set(pending.map(i => i.parentKey!)));
  const parentsByKey = new Map<string, JiraIssue>();
  // 30 chaves por chamada mantém a URL da GET /search em tamanho seguro
  for (let i = 0; i < parentKeys.length; i += 30) {
    const chunkKeys = parentKeys.slice(i, i + 30);
    const jql = `key in (${chunkKeys.join(',')})`;
    try {
      const { issues: parents } = await fetchJiraIssues(domain, token, jql, { maxResults: 100 });
      parents.forEach(p => parentsByKey.set(p.key, p));
    } catch (e) {
      // Uma falha pontual nessa busca extra não derruba a importação
      console.warn('[enrichWithParentContext] Falha ao buscar issue pai:', e);
    }
  }

  if (parentsByKey.size === 0) return issues;

  return issues.map(issue => {
    if (!issue.parentKey) return issue;
    const parent = parentsByKey.get(issue.parentKey);
    if (!parent) return issue;

    return {
      ...issue,
      problem: issue.problem || parent.problem,
      solution: issue.solution || parent.solution,
      acceptanceCriteria: issue.acceptanceCriteria || parent.acceptanceCriteria,
      videoUrl: issue.videoUrl || parent.videoUrl,
    };
  });
};
