import { authFetch } from '@/lib/auth-client';
import type { IssueSources } from './jiraProvenance';
import { fieldValue } from './jiraProvenance';
import type { JiraIssue, RawIssueText } from './jiraService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/** O servidor aceita até 200 issues por pedido (docs/jira-import-origem-api.md). */
const CHUNK = 200;

interface ServerIssue {
  key: string;
  type?: string;
  title?: string;
  description: string;
  criteriaField?: string;
  comments: RawIssueText['comments'];
  subtasks?: ServerIssue[];
  parent?: ServerIssue;
}

const toServerIssue = (raw: RawIssueText): ServerIssue => ({
  key: raw.key, type: raw.type, title: raw.title, description: raw.description, criteriaField: raw.criteriaField, comments: raw.comments,
});

/**
 * Pede ao servidor a origem de cada texto (a regra mora no backend, com testes). Backend antigo (rota inexistente), erro ou
 * resposta fora do formato: devolve as issues como estão, com a regra local que já rodou no navegador. Nunca derruba a busca.
 */
export async function refineSourcesWithServer(issues: JiraIssue[]): Promise<JiraIssue[]> {
  const withRaw = issues.filter((i) => i.raw);
  if (withRaw.length === 0) return issues;

  const byKey = new Map<string, IssueSources>();
  try {
    for (let i = 0; i < withRaw.length; i += CHUNK) {
      const chunk = withRaw.slice(i, i + CHUNK);
      const res = await authFetch(`${API_BASE_URL}/jira/text-sources`, {
        method: 'POST',
        body: JSON.stringify({
          issues: chunk.map((issue) => ({
            ...toServerIssue(issue.raw!),
            subtasks: issue.relatedRaw?.subtasks?.map(toServerIssue),
            parent: issue.relatedRaw?.parent ? toServerIssue(issue.relatedRaw.parent) : undefined,
          })),
        }),
      });
      if (!res.ok) return issues;
      const body = (await res.json()) as { issues?: Array<IssueSources & { key: string }> };
      if (!Array.isArray(body.issues) || body.issues.length !== chunk.length) return issues;
      // O servidor manda sourceId: null quando o campo fica vazio; aqui é "ausente".
      const clean = (f: IssueSources['problem']) => ({ ...f, sourceId: f.sourceId ?? undefined });
      body.issues.forEach((s) => byKey.set(s.key, { problem: clean(s.problem), solution: clean(s.solution), acceptanceCriteria: clean(s.acceptanceCriteria) }));
    }
  } catch {
    return issues;
  }

  return issues.map((issue) => {
    const sources = byKey.get(issue.key);
    if (!sources) return issue;
    return {
      ...issue,
      sources,
      problem: fieldValue(sources.problem),
      solution: fieldValue(sources.solution),
      acceptanceCriteria: fieldValue(sources.acceptanceCriteria),
    };
  });
}
