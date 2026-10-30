import type { SquadMember } from '@/lib/types';
import { MAX_DAILY_HOURS } from './constants';
import { normalizeText } from './calc';
import { csvDocument, csvLine, parseCsv, type CsvDelimiter } from './csv';
import { parseDecimal } from './numbers';

/** Colunas da planilha do time, na ordem em que a exportação as grava. */
export const ROSTER_CSV_HEADERS = [
  'JiraAccountId',
  'Nome',
  'Email',
  'Funcao',
  'Horas_Sugeridas_Sistema_Dia',
  'Horas_Reais_Gestor_Dia',
  'Fonte_Carga_Horaria',
  'Observacoes',
] as const;

type Field = 'id' | 'name' | 'email' | 'role' | 'suggested' | 'real' | 'source' | 'notes';

const HEADER_ALIASES: Record<Field, string[]> = {
  id: ['jiraaccountid', 'accountid', 'idconta', 'idjira', 'id'],
  name: ['nome', 'name', 'displayname', 'integrante', 'pessoa'],
  email: ['email', 'emailcorporativo'],
  role: ['funcao', 'cargo', 'role', 'papel'],
  suggested: ['horassugeridassistemadia', 'horassugeridas', 'sugeridas', 'sugerida'],
  real: ['horasreaisgestordia', 'horasreais', 'horasdia', 'horaspordia', 'horas', 'real', 'reais', 'capacidade'],
  source: ['fontecargahoraria', 'fonte'],
  notes: ['observacoes', 'observacao', 'notas', 'notes'],
};

/** Posição padrão de cada coluna (a ordem da exportação), usada quando o cabeçalho não ajuda. */
const POSITIONAL: Record<Field, number> = { id: 0, name: 1, email: 2, role: 3, suggested: 4, real: 5, source: 6, notes: 7 };

const SOURCE_VALUES = /^(SYSTEM|MANUAL_OVERRIDE|IMPORTED_EXCEL)$/i;

const normHeader = (h: string) => normalizeText(h).replace(/[^a-z0-9]/g, '');

/** Mapeia cada campo para a coluna do cabeçalho; devolve null quando o cabeçalho não é reconhecível. */
export function mapHeader(header: string[]): Partial<Record<Field, number>> | null {
  const normalized = header.map(normHeader);
  const map: Partial<Record<Field, number>> = {};
  (Object.keys(HEADER_ALIASES) as Field[]).forEach((field) => {
    const idx = normalized.findIndex((h) => HEADER_ALIASES[field].includes(h));
    if (idx >= 0) map[field] = idx;
  });
  return Object.keys(map).length >= 2 ? map : null;
}

export type MatchKind = 'id' | 'email' | 'name';
export type ImportStatus = 'changed' | 'unchanged' | 'new';

export interface ImportRow {
  /** Linha no arquivo (1 = cabeçalho). */
  line: number;
  jiraAccountId: string;
  displayName: string;
  role: string;
  email: string;
  importedCapacity: number;
  /** Horas atuais da pessoa na squad (ou o padrão, para quem é novo). */
  currentCapacity: number;
  /** A planilha não trouxe horas legíveis (vazio, ≤ 0 ou > 24): ficou o valor atual. */
  capacityKept: boolean;
  notes: string;
  existingMember?: SquadMember;
  matchedBy: MatchKind | null;
  status: ImportStatus;
}

export interface ImportParseResult {
  delimiter: CsvDelimiter;
  rows: ImportRow[];
  /** Linhas ignoradas: sem nome, e-mail nem ID, com e-mail inválido que criaria um integrante novo, ou repetindo uma pessoa já lida no arquivo. */
  skipped: number;
}

export type ImportParseError = 'EMPTY';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function findMemberMatch(
  members: SquadMember[],
  key: { id: string; email: string; name: string }
): { member: SquadMember; by: MatchKind } | null {
  const id = key.id.trim().toLowerCase();
  if (id) {
    const m = members.find((x) => (x.jiraAccountId || '').trim().toLowerCase() === id);
    if (m) return { member: m, by: 'id' };
  }
  const email = key.email.trim().toLowerCase();
  if (email) {
    const m = members.find((x) => x.email && x.email.trim().toLowerCase() === email);
    if (m) return { member: m, by: 'email' };
  }
  const name = normalizeText(key.name.trim());
  if (name) {
    const m = members.find((x) => normalizeText(x.displayName) === name);
    if (m) return { member: m, by: 'name' };
  }
  return null;
}

/**
 * Lê a planilha do time. O casamento com quem já está na squad segue a ordem ID da conta, e-mail, nome (o nome
 * sozinho vem marcado para conferência). Primeira linha é o cabeçalho; "," e ";" são detectados.
 * Devolve 'EMPTY' quando não há ao menos cabeçalho e uma linha de dados.
 */
export function parseRosterImport(
  text: string,
  members: SquadMember[],
  baseHours: number
): ImportParseResult | ImportParseError {
  const { delimiter, rows: lines } = parseCsv(text);
  if (lines.length < 2) return 'EMPTY';

  const header = mapHeader(lines[0]);
  const col = (f: Field) => (header ? header[f] : POSITIONAL[f]);
  const cell = (cols: string[], f: Field): string => {
    const i = col(f);
    return i === undefined ? '' : (cols[i] ?? '').trim();
  };

  const rows: ImportRow[] = [];
  let skipped = 0;
  // Pessoas novas já lidas neste arquivo: a mesma pessoa em duas linhas (mesmo ID, e-mail ou nome) vale uma só vez.
  const seenNew: SquadMember[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (!header && cols.length < 2) {
      skipped++;
      continue;
    }
    const idRaw = cell(cols, 'id');
    const nameRaw = cell(cols, 'name');
    const emailRaw = cell(cols, 'email');
    if (!idRaw && !nameRaw && !emailRaw) {
      skipped++;
      continue;
    }

    // Planilhas antigas: horas reais na coluna 5, ou na 4 quando só havia uma coluna de horas.
    const realRaw = cell(cols, 'real') || (header ? '' : cell(cols, 'suggested'));
    let notes = cell(cols, 'notes');
    if (!notes && !header) {
      const legacy = (cols[6] ?? '').trim();
      if (legacy && !SOURCE_VALUES.test(legacy)) notes = legacy;
    }

    // E-mail fora do formato não casa ninguém e não cria integrante novo: a linha é ignorada (conta em `skipped`).
    const emailOk = !emailRaw || EMAIL_FORMAT.test(emailRaw);
    const match = findMemberMatch(members, { id: idRaw, email: emailOk ? emailRaw : '', name: nameRaw });
    const existing = match?.member;
    if (!existing && !emailOk) {
      skipped++;
      continue;
    }
    if (!existing && findMemberMatch(seenNew, { id: idRaw, email: emailOk ? emailRaw : '', name: idRaw || emailRaw ? '' : nameRaw })) {
      skipped++;
      continue;
    }
    const parsed = parseDecimal(realRaw);
    const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_DAILY_HOURS;
    const current = existing?.capacityHoursPerDay ?? baseHours;
    const imported = valid ? parsed : current;
    const roleRaw = cell(cols, 'role');
    const role = roleRaw || existing?.role || 'Developer';

    const status: ImportStatus = !existing
      ? 'new'
      : current !== imported || (!!roleRaw && roleRaw !== (existing.role || 'Developer'))
        ? 'changed'
        : 'unchanged';

    if (!existing) {
      seenNew.push({
        dbId: '',
        squadId: '',
        jiraAccountId: idRaw || emailRaw.trim().toLowerCase(),
        displayName: nameRaw,
        email: emailOk ? emailRaw.trim().toLowerCase() : '',
      } as SquadMember);
    }

    rows.push({
      line: i + 1,
      jiraAccountId: existing ? existing.jiraAccountId : idRaw,
      displayName: existing ? existing.displayName : nameRaw || idRaw || emailRaw,
      role,
      email: (emailOk ? emailRaw : '') || existing?.email || '',
      importedCapacity: imported,
      currentCapacity: current,
      capacityKept: !valid,
      notes: notes || 'Importado via planilha',
      existingMember: existing,
      matchedBy: match?.by ?? null,
      status,
    });
  }

  return { delimiter, rows, skipped };
}

export interface ImportSummary {
  total: number;
  changed: number;
  unchanged: number;
  added: number;
  /** Linhas que casaram só pelo nome: vale conferir antes de aplicar. */
  nameOnly: number;
  matchedById: number;
  matchedByEmail: number;
  matchedByName: number;
}

export function summarizeImport(rows: ImportRow[]): ImportSummary {
  return {
    total: rows.length,
    changed: rows.filter((r) => r.status === 'changed').length,
    unchanged: rows.filter((r) => r.status === 'unchanged').length,
    added: rows.filter((r) => r.status === 'new').length,
    nameOnly: rows.filter((r) => r.matchedBy === 'name').length,
    matchedById: rows.filter((r) => r.matchedBy === 'id').length,
    matchedByEmail: rows.filter((r) => r.matchedBy === 'email').length,
    matchedByName: rows.filter((r) => r.matchedBy === 'name').length,
  };
}

const slug = (s: string) => normalizeText(s).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');

/** Quem é novo e veio sem ID da conta ganha um identificador estável (e-mail, ou o nome sem acentos). */
export function importAccountId(row: ImportRow): string {
  return row.jiraAccountId || row.email.trim().toLowerCase() || `import.${slug(row.displayName) || 'integrante'}`;
}

/** Lista a gravar quando a pessoa confirma a importação. */
export function buildImportMembers(
  rows: ImportRow[],
  squadId: string,
  baseHours: number,
  suggestedFor: (existing: SquadMember) => number,
  now: Date = new Date()
): SquadMember[] {
  return rows.map((row) => {
    const existing = row.existingMember;
    const jiraAccountId = importAccountId(row);
    return {
      dbId: existing?.dbId || `${squadId}_${jiraAccountId}`,
      squadId,
      jiraAccountId,
      displayName: row.displayName,
      email: row.email.trim().toLowerCase(),
      role: row.role,
      capacityHoursPerDay: row.importedCapacity,
      systemCalculatedCapacityHoursPerDay: existing ? suggestedFor(existing) : baseHours,
      calibrationNotes: row.notes,
      overrideType: 'IMPORTED_EXCEL',
      claimedByUid: existing?.claimedByUid,
      updatedAt: now.toISOString(),
    };
  });
}

export interface ExportRow {
  member: SquadMember;
  role: string;
  suggested: number;
  real: number;
  source: string;
  notes: string;
}

/** CSV da exportação (separador vírgula, ponto decimal), com BOM para o Excel ler os acentos. */
export function buildRosterExportCsv(rows: ExportRow[]): string {
  const lines = rows.map((r) =>
    csvLine(
      [r.member.jiraAccountId, r.member.displayName, r.member.email || '', r.role || 'Developer', r.suggested, r.real, r.source, r.notes || ''],
      ','
    )
  );
  return csvDocument([csvLine([...ROSTER_CSV_HEADERS], ','), ...lines]);
}

/** Modelo para baixar: separador ";" e vírgula decimal, que é como o Excel em português abre e salva. */
export function buildRosterTemplateCsv(): string {
  const d: CsvDelimiter = ';';
  return csvDocument([
    csvLine([...ROSTER_CSV_HEADERS], d),
    csvLine(['ana.souza', 'Ana Souza', 'ana.souza@empresa.com', 'Developer', '6', '5,5', 'MANUAL_OVERRIDE', ''], d),
    csvLine(['bruno.lima', 'Bruno Lima', 'bruno.lima@empresa.com', 'QA', '6', '6', 'SYSTEM', 'Meio período às sextas'], d),
  ]);
}
