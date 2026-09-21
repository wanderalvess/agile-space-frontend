/**
 * Extração baseada em regra do texto de uma nota de daily (ex: a nota que o Google
 * Meet já gera sozinho). Não depende de nenhuma IA nem chave de API — existe pra
 * validar a tela e o fluxo ponta a ponta antes de decidir provedor/orçamento de IA.
 * A rota /api/daily-digest/extract chama isso sempre e, se useAi=true e houver um
 * provedor configurado, tenta melhorar o resultado com um modelo por cima.
 */

export interface DailyDigestEntry {
  name: string;
  today: string;
  blockers: string;
  hasBlocker: boolean;
}

export interface DailyDigestActionItem {
  text: string;
  jiraKey: string | null;
}

export interface DailyDigestResult {
  entries: DailyDigestEntry[];
  actionItems: DailyDigestActionItem[];
  jiraKeys: string[];
}

const JIRA_KEY_REGEX = /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g;

const BLOCKER_KEYWORDS = [
  'bloque',
  'trava',
  'travad',
  'impedi',
  'preso',
  'aguardando aprova',
  'sem acesso',
  'depend',
];

const ACTION_SECTION_HEADERS = [
  'itens de ação',
  'ação',
  'ações',
  'action items',
  'próximos passos',
  'next steps',
  'to-do',
  'todo',
];

// "Nome Sobrenome: fez isso" ou "Nome Sobrenome - fez isso" — heurística simples pra
// separar quem falou o quê numa nota de reunião com várias pessoas.
const PERSON_LINE_REGEX = /^[-*•]?\s*([A-ZÀ-Ú][\wà-ú]+(?:\s[A-ZÀ-Ú][\wà-ú]+){0,2})\s*[:\-–]\s*(.+)$/;

const BULLET_LINE_REGEX = /^[-*•]\s*(.+)$/;

function containsBlockerKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKER_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractJiraKeys(text: string): string[] {
  return Array.from(new Set(text.match(JIRA_KEY_REGEX) ?? []));
}

export function ruleBasedExtract(rawText: string): DailyDigestResult {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const entriesByName = new Map<string, DailyDigestEntry>();
  const actionItems: DailyDigestActionItem[] = [];
  let inActionSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase().replace(/[:#]/g, '').trim();
    if (ACTION_SECTION_HEADERS.some((h) => lowerLine === h)) {
      inActionSection = true;
      continue;
    }
    // Um novo cabeçalho de seção genérico (linha curta, sem pontuação de frase) encerra a seção de ações.
    if (inActionSection && line.length < 40 && !BULLET_LINE_REGEX.test(line) && !line.includes('.')) {
      inActionSection = false;
    }

    const bulletMatch = line.match(BULLET_LINE_REGEX);
    const personMatch = line.match(PERSON_LINE_REGEX);

    if (inActionSection && bulletMatch) {
      const text = bulletMatch[1].trim();
      const keys = extractJiraKeys(text);
      actionItems.push({ text, jiraKey: keys[0] ?? null });
      continue;
    }

    if (personMatch) {
      const name = personMatch[1].trim();
      const text = personMatch[2].trim();
      const isBlocker = containsBlockerKeyword(text);
      const existing = entriesByName.get(name) ?? { name, today: '', blockers: '', hasBlocker: false };
      if (isBlocker) {
        existing.blockers = existing.blockers ? `${existing.blockers}\n${text}` : text;
        existing.hasBlocker = true;
      } else {
        existing.today = existing.today ? `${existing.today}\n${text}` : text;
      }
      entriesByName.set(name, existing);
      continue;
    }

    // Linha solta que não bate com pessoa nem está numa seção de ação: se citar um bloqueio
    // ou uma chave do Jira, ainda vale guardar como action item "sem dono".
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      const keys = extractJiraKeys(text);
      if (keys.length > 0 || containsBlockerKeyword(text)) {
        actionItems.push({ text, jiraKey: keys[0] ?? null });
      }
    }
  }

  const jiraKeys = extractJiraKeys(rawText);

  return {
    entries: Array.from(entriesByName.values()),
    actionItems,
    jiraKeys,
  };
}
