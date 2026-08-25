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
  dueDate?: string; // campo `duedate` do Jira, formato YYYY-MM-DD
  targetStart?: string;
  targetEnd?: string;
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
 * Remove tags HTML e decodifica entidades de texto
 */
const stripHtml = (html: string): string => {
  if (!html) return '';
  // Limpa as tags HTML
  let text = html.replace(/<[^>]*>?/gm, ' ');
  // Decodifica entidades comuns que o Jira exporta
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  // Remove espaços duplos e colchetes residuais de links
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Helpers para extração de dados da descrição via Regex
 */
const parseAcceptanceCriteriaFromDescription = (desc: string) => {
  if (!desc) return '';
  const acMatch = desc.match(/(?:CRIT[ÉÉ]RIOS? DE ACEITE|ACCEPTANCE CRITERIA|CRIT[ÉÉ]RIOS? DE ACEITAÇÃO|O QUE SERÁ TESTADO):?\s*([\s\S]*?)(?:PROBLEMA|SOLUÇÃO|VÍDEO|---|[#*]|$)/i);
  return acMatch ? stripHtml(acMatch[1]) : '';
};

const parseProblemFromDescription = (desc: string) => {
  if (!desc) return '';
  const probMatch = desc.match(/(?:PROBLEMA|MOTIVAÇÃO|POR QUE):?([\s\S]*?)(?:SOLUÇÃO|VÍDEO|---|<br|[#*]|$)/i);
  return probMatch ? stripHtml(probMatch[1]) : '';
};

const parseSolutionFromDescription = (desc: string) => {
  if (!desc) return '';
  const solMatch = desc.match(/(?:SOLUÇÃO|O QUE FOI FEITO|COMO FOI FEITO):?([\s\S]*?)(?:PROBLEMA|VÍDEO|---|<br|[#*]|$)/i);
  return solMatch ? stripHtml(solMatch[1]) : '';
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

      // --- EXTRAÇÃO DE CRITÉRIOS DE ACEITE DA DESCRIÇÃO ---
      if (!acceptanceCriteria && description) {
        const acMatch = description.match(/(?:CRIT[ÉÉ]RIOS? DE ACEITE|ACCEPTANCE CRITERIA|CRIT[ÉÉ]RIOS? DE ACEITAÇÃO):?\s*([\s\S]*?)(?:PROBLEMA|SOLUÇÃO|VÍDEO|---|#|$)/i);
        if (acMatch) acceptanceCriteria = stripHtml(acMatch[1]);
      }

      // Varrer COMENTÁRIOS para achar Problema, Solução e Vídeos
      const comments = Array.from(item.querySelectorAll('comment')).map(c => ({
        author: c.getAttribute('author') || '',
        text: c.textContent?.trim() || ''
      }));

      // Extrair Vídeo de qualquer comentário (prioridade Drive)
      const allText = description + ' ' + comments.map(c => c.text).join(' ');
      videoUrl = extractDriveLink(allText);

      // Prioridade para comentários do DEV para Problema e Solução
      const devComments = comments.filter(c => c.author === devUsername);
      const searchTarget = devComments.length > 0 ? devComments.map(c => c.text).join(' ') : allText;

      const probMatch = searchTarget.match(/PROBLEMA:?([\s\S]*?)(?:SOLUÇÃO|VÍDEO|---|<br|$)/i);
      const solMatch = searchTarget.match(/SOLUÇÃO:?([\s\S]*?)(?:PROBLEMA|VÍDEO|---|<br|$)/i);

      problem = probMatch ? stripHtml(probMatch[1]) : '';
      solution = solMatch ? stripHtml(solMatch[1]) : '';

      // Fallback para campos específicos se não achar no texto
      if (!solution) {
        item.querySelectorAll('customfield').forEach(cf => {
          if (cf.getAttribute('id') === 'customfield_10410') {
            const raw = cf.querySelector('customfieldvalue')?.textContent || '';
            const match = raw.match(/Solução:([\s\S]*)/i);
            solution = match ? match[1].trim() : raw.trim();
          }
        });
      }

      // Cleanup final do problema se estiver vazio
      if (!problem && description) {
        const dMatch = description.match(/PROBLEMA:?([\s\S]*?)(?:SOLUÇÃO|---|<br|$)/i);
        problem = dMatch ? stripHtml(dMatch[1]) : stripHtml(description.split('----')[0]);
      }

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

    // Automação simplificada via API (Regex na descrição e campos custom)
    const probMatch = desc.match(/PROBLEMA:?([\s\S]*?)(?:SOLUÇÃO|$)/i);
    const solMatch = desc.match(/SOLUÇÃO:?([\s\S]*?)(?:PROBLEMA|$)/i);

    // Extração Inteligente de Critérios de Aceite
    let acceptanceCriteria = fields?.customfield_10100 || '';
    if (!acceptanceCriteria) {
      const acMatch = desc.match(/(?:CRIT[ÉÉ]RIOS? DE ACEITE|ACCEPTANCE CRITERIA|CRIT[ÉÉ]RIOS? DE ACEITAÇÃO):?\s*([\s\S]*?)(?:PROBLEMA|SOLUÇÃO|VÍDEO|---|#|$)/i);
      if (acMatch) acceptanceCriteria = acMatch[1].trim();
    }

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
      updated: fields?.updated || '',
      dueDate: fields?.duedate || '',
      targetStart: fields?.customfield_10015 || fields?.startDate || fields?.target_start || (fields?.created ? fields.created.substring(0, 10) : ''),
      targetEnd: fields?.customfield_10014 || fields?.duedate || fields?.target_end || (fields?.updated ? fields.updated.substring(0, 10) : ''),
      parentKey: fields?.parent?.key || '',
      parentTitle: fields?.parent?.fields?.summary || '',
      labels: fields?.labels || [],
      points,
      planned: parsePlannedFromTitle(fields?.summary || ''),
      acceptanceCriteria: acceptanceCriteria || parseAcceptanceCriteriaFromDescription(desc),
      problem: parseProblemFromDescription(commentsText) || parseProblemFromDescription(desc),
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
      sprintRaw: opts?.sprintFieldId ? fields?.[opts.sprintFieldId] : undefined,
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
): Promise<{ issues: JiraIssue[]; total: number }> => {
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

  return { issues: allIssues, total };
};

/**
 * Preenche problema/solução/vídeo a partir da subtarefa "Codificação" quando a
 * issue principal não trouxe essa informação (nem na descrição, nem no
 * comentário dela) — nesse Jira, quem carrega o relato técnico é a issue
 * filha nativa (fields.parent aponta pra história/issue principal), não a
 * história em si. Ver SQUAD_SYNC_FIELDS_BASE em useSquadStore.ts, que já
 * assume essa mesma convenção pro rastreio de hora.
 */
export const enrichWithCodificacaoChildren = async (
  domain: string, token: string, issues: JiraIssue[]
): Promise<JiraIssue[]> => {
  const pending = issues.filter(i => !i.problem || !i.solution);
  if (pending.length === 0) return issues;

  const childByParent = new Map<string, JiraIssue>();
  // 40 chaves por chamada mantém a URL da GET /search dentro de um tamanho
  // seguro (Jira aceita bem mais no IN(), o limite prático é a URL).
  for (let i = 0; i < pending.length; i += 40) {
    const chunkKeys = pending.slice(i, i + 40).map(p => p.key);
    const jql = `parent in (${chunkKeys.join(',')}) AND issuetype = "Codificação"`;
    try {
      const { issues: children } = await fetchJiraIssues(domain, token, jql);
      children.forEach(child => {
        if (child.parentKey) childByParent.set(child.parentKey, child);
      });
    } catch (e) {
      // Uma falha pontual nessa busca extra não pode derrubar o import
      // inteiro — as issues afetadas só ficam sem o enriquecimento.
      console.error('[enrichWithCodificacaoChildren] Falha ao buscar subtarefas de Codificação:', e);
    }
  }

  if (childByParent.size === 0) return issues;

  return issues.map(issue => {
    const child = childByParent.get(issue.key);
    if (!child) return issue;
    return {
      ...issue,
      problem: issue.problem || child.problem,
      solution: issue.solution || child.solution,
      videoUrl: issue.videoUrl || child.videoUrl,
      project: issue.project || child.project,
      versionMaster: issue.versionMaster || child.versionMaster,
      versionDevelop: issue.versionDevelop || child.versionDevelop,
      versionRelease: issue.versionRelease || child.versionRelease,
    };
  });
};
