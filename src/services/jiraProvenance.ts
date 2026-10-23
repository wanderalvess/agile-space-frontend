import type { JiraIssue } from './jiraService';

/**
 * Origem dos textos que a importação do Jira põe nos campos da Review.
 *
 * Cada campo (Problema, Solução, Critérios) tem uma lista de fontes candidatas: campo do Jira, descrição, cada comentário,
 * subtarefa e issue pai. Uma fonte é "explícita" quando o texto veio de um título conhecido ("Solução:") ou de um campo do
 * Jira; é palpite quando só foi deduzida (começo da descrição, lista de linhas em Gherkin). Só texto explícito e sem
 * concorrência entra sozinho; palpite e conflito deixam o campo vazio até a pessoa escolher.
 */
export type ProvenanceField = 'problem' | 'solution' | 'acceptanceCriteria';
export type SourceKind = 'campo' | 'comentario' | 'descricao' | 'subtarefa' | 'pai';
/** certa = entra preenchido; revisar = a pessoa escolhe; vazio = nada confiável. */
export type Confidence = 'certa' | 'revisar' | 'vazio';

export interface TextSource {
  id: string;
  kind: SourceKind;
  /** Texto curto para a lista: "Comentário de Ana Ribeiro, 12/10". */
  label: string;
  text: string;
  /** true = veio de título conhecido ou de campo do Jira; false = palpite. */
  explicit: boolean;
}

export interface FieldProvenance {
  confidence: Confidence;
  /** Fonte aceita (única explícita ou escolhida pela pessoa). Sem ela o campo fica vazio. */
  sourceId?: string;
  /** true quando a pessoa escolheu a fonte (ou deixou vazio) na conferência. */
  chosenByUser?: boolean;
  candidates: TextSource[];
}

export type IssueSources = Record<ProvenanceField, FieldProvenance>;

export const PROVENANCE_FIELDS: readonly ProvenanceField[] = ['problem', 'solution', 'acceptanceCriteria'];

export const FIELD_LABEL: Record<ProvenanceField, string> = {
  problem: 'Problema',
  solution: 'Solução',
  acceptanceCriteria: 'Critérios de aceite',
};

const normText = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Tira candidatos vazios e repetidos (mesmo texto em duas fontes conta uma vez; a explícita ganha do palpite). */
function dedupe(candidates: TextSource[]): TextSource[] {
  const out: TextSource[] = [];
  for (const c of candidates) {
    if (!c.text.trim()) continue;
    const same = out.findIndex((o) => normText(o.text) === normText(c.text));
    if (same < 0) { out.push(c); continue; }
    if (c.explicit && !out[same].explicit) out[same] = c;
  }
  return out;
}

/** Uma explícita sozinha = certa; várias explícitas diferentes ou só palpite = revisar; nada = vazio. */
export function classify(candidates: TextSource[]): FieldProvenance {
  const list = dedupe(candidates);
  const explicit = list.filter((c) => c.explicit);
  if (explicit.length === 1) return { confidence: 'certa', sourceId: explicit[0].id, candidates: list };
  if (explicit.length > 1 || list.length > 0) return { confidence: 'revisar', candidates: list };
  return { confidence: 'vazio', candidates: [] };
}

/** Texto da fonte aceita, ou vazio. */
export function fieldValue(p: FieldProvenance | undefined): string {
  if (!p?.sourceId) return '';
  return p.candidates.find((c) => c.id === p.sourceId)?.text ?? '';
}

/**
 * Junta fontes de subtarefa ou issue pai só quando a própria issue não tem texto explícito para o campo: história com
 * "Problema:" próprio não briga com o que a subtarefa repete.
 */
export function withFallbackSources(p: FieldProvenance, extra: TextSource[]): FieldProvenance {
  if (p.candidates.some((c) => c.explicit)) return p;
  const extras = extra.filter((c) => c.text.trim());
  if (extras.length === 0) return p;
  return classify([...p.candidates, ...extras]);
}

/** Campos que ainda pedem a decisão da pessoa. */
export function pendingFields(issue: Pick<JiraIssue, 'sources'>): ProvenanceField[] {
  const s = issue.sources;
  if (!s) return [];
  return PROVENANCE_FIELDS.filter((f) => s[f].confidence === 'revisar' && !s[f].sourceId);
}

/** Aplica a escolha da pessoa: uma fonte da lista ou null para deixar o campo vazio. Devolve uma cópia. */
export function applyChoice(issue: JiraIssue, field: ProvenanceField, sourceId: string | null): JiraIssue {
  if (!issue.sources) return issue;
  const prev = issue.sources[field];
  if (sourceId && !prev.candidates.some((c) => c.id === sourceId)) return issue;
  const next: FieldProvenance = {
    ...prev,
    sourceId: sourceId ?? undefined,
    confidence: sourceId ? 'certa' : 'vazio',
    chosenByUser: prev.confidence !== 'certa' || prev.sourceId !== sourceId,
  };
  return {
    ...issue,
    sources: { ...issue.sources, [field]: next },
    [field]: fieldValue(next),
  };
}

/** Escolhas pendentes para decisões por chave: { 'PTV-1': { problem: 'c1' | null } }. */
export type ImportChoices = Record<string, Partial<Record<ProvenanceField, string | null>>>;

/** Aplica todas as escolhas feitas na etapa de conferência às issues escolhidas. */
export function applyChoices(issues: JiraIssue[], choices: ImportChoices): JiraIssue[] {
  return issues.map((issue) => {
    const picked = choices[issue.key];
    if (!picked) return issue;
    return (Object.keys(picked) as ProvenanceField[]).reduce(
      (acc, field) => applyChoice(acc, field, picked[field] ?? null),
      issue,
    );
  });
}

/** Resumo para o cabeçalho da conferência: quantas issues estão certas, para revisar ou sem texto. */
export function summarize(issues: JiraIssue[], choices: ImportChoices = {}): { certas: number; revisar: number; semTexto: number } {
  let certas = 0, revisar = 0, semTexto = 0;
  for (const issue of applyChoices(issues, choices)) {
    if (!issue.sources) { certas += 1; continue; }
    const states = PROVENANCE_FIELDS.map((f) => issue.sources![f]);
    if (states.some((s) => s.confidence === 'revisar' && !s.sourceId)) revisar += 1;
    else if (states.every((s) => !s.sourceId)) semTexto += 1;
    else certas += 1;
  }
  return { certas, revisar, semTexto };
}

/** Data curta para o rótulo da fonte: "12/10". */
export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function commentLabel(author?: string, created?: string): string {
  const date = shortDate(created);
  return `Comentário${author ? ` de ${author}` : ''}${date ? `, ${date}` : ''}`;
}
