/**
 * Resumo da importação do Jira para a tela de resultado. Só usa o que o servidor já devolve ao gravar
 * (as pessoas de cada squad, com `userId` quando há conta ligada e `email` quando o Jira informou).
 * Nenhum número é estimado: o que não tem fonte fica de fora.
 *
 * As pessoas se dividem em três grupos que somam o total:
 *  - com conta: já têm conta do Portal ligada;
 *  - atenção: sem conta e sem e-mail no Jira (a conta não liga sozinha) ou liderança sem conta
 *    (liderança não se autodeclara);
 *  - sem conta: o resto; entram pelo e-mail ao se cadastrar ou por convite.
 */

import type { ProjectDetail, ProjectMemberRoleItem } from '@/services/projectService';

export type SquadStatus = 'active' | 'imported';

export interface SquadSummary {
  id: string;
  name: string;
  status: SquadStatus;
  people: number;
  withAccount: number;
  withoutAccount: number;
  attention: number;
  /** Sem conta e sem e-mail no Jira. */
  noEmail: ProjectMemberRoleItem[];
  /** Liderança sem conta e com e-mail. */
  leadersWithoutAccount: ProjectMemberRoleItem[];
}

export interface ImportSummary {
  squads: SquadSummary[];
  skippedKeys: string[];
  people: number;
  withAccount: number;
  withoutAccount: number;
  attention: number;
}

const hasAccount = (m: ProjectMemberRoleItem) => !!m.userId?.trim();
const hasEmail = (m: ProjectMemberRoleItem) => !!m.email?.trim();

export function summarizeSquad(project: ProjectDetail, status: SquadStatus): SquadSummary {
  const members = project.members ?? [];
  const withAccount = members.filter(hasAccount);
  const unlinked = members.filter((m) => !hasAccount(m));
  const noEmail = unlinked.filter((m) => !hasEmail(m));
  const leadersWithoutAccount = unlinked.filter((m) => m.leadership && hasEmail(m));
  const attention = noEmail.length + leadersWithoutAccount.length;
  return {
    id: project.id,
    name: project.name && project.name.toUpperCase() !== project.id.toUpperCase() ? project.name : project.id,
    status,
    people: members.length,
    withAccount: withAccount.length,
    withoutAccount: unlinked.length - attention,
    attention,
    noEmail,
    leadersWithoutAccount,
  };
}

export function summarizeImport(imported: ProjectDetail[], skippedKeys: string[]): ImportSummary {
  const squads = imported.map((p, i) => summarizeSquad(p, i === 0 ? 'active' : 'imported'));
  const sum = (pick: (s: SquadSummary) => number) => squads.reduce((total, s) => total + pick(s), 0);
  return {
    squads,
    skippedKeys,
    people: sum((s) => s.people),
    withAccount: sum((s) => s.withAccount),
    withoutAccount: sum((s) => s.withoutAccount),
    attention: sum((s) => s.attention),
  };
}

export type IssueAction = 'invite' | 'request-link' | 'import';

export interface ImportIssue {
  id: string;
  tone: 'warn' | 'neutral' | 'danger';
  title: string;
  detail: string;
  action: { kind: IssueAction; label: string };
  projectKey?: string;
  /** Só quando o pedido de vínculo é sobre uma única pessoa. */
  memberId?: string;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pendências da importação, em ordem: sem e-mail, liderança, sem conta, squads puladas. */
export function buildIssues(summary: ImportSummary): ImportIssue[] {
  const issues: ImportIssue[] = [];

  for (const s of summary.squads) {
    if (s.noEmail.length === 1) {
      issues.push({
        id: `no-email-${s.id}`,
        tone: 'warn',
        title: `${s.noEmail[0].displayName} · ${s.id}`,
        detail: 'Sem e-mail no Jira: a conta não liga sozinha.',
        action: { kind: 'invite', label: 'Gerar convite' },
        projectKey: s.id,
      });
    } else if (s.noEmail.length > 1) {
      issues.push({
        id: `no-email-${s.id}`,
        tone: 'warn',
        title: `${plural(s.noEmail.length, 'pessoa', 'pessoas')} sem e-mail · ${s.id}`,
        detail: 'Sem e-mail no Jira: a conta não liga sozinha.',
        action: { kind: 'invite', label: 'Gerar convites' },
        projectKey: s.id,
      });
    }
  }

  for (const s of summary.squads) {
    if (s.leadersWithoutAccount.length === 1) {
      const leader = s.leadersWithoutAccount[0];
      issues.push({
        id: `leader-${s.id}`,
        tone: 'warn',
        title: `${leader.displayName} · ${s.id}`,
        detail: 'Liderança sem conta: só entra com vínculo aprovado.',
        action: { kind: 'request-link', label: 'Pedir vínculo' },
        projectKey: s.id,
        memberId: leader.id,
      });
    } else if (s.leadersWithoutAccount.length > 1) {
      issues.push({
        id: `leader-${s.id}`,
        tone: 'warn',
        title: `${plural(s.leadersWithoutAccount.length, 'liderança', 'lideranças')} sem conta · ${s.id}`,
        detail: 'Liderança só entra com vínculo aprovado.',
        action: { kind: 'request-link', label: 'Pedir vínculo' },
        projectKey: s.id,
      });
    }
  }

  if (summary.withoutAccount > 0) {
    issues.push({
      id: 'no-account',
      tone: 'neutral',
      title: `${plural(summary.withoutAccount, 'pessoa sem conta', 'pessoas sem conta')}`,
      detail: 'Entram pelo e-mail ao se cadastrar, ou por convite.',
      action: { kind: 'invite', label: 'Convidar' },
    });
  }

  for (const key of summary.skippedKeys) {
    issues.push({
      id: `skipped-${key}`,
      tone: 'danger',
      title: key,
      detail: 'Pulada. Dá para importar de novo quando quiser.',
      action: { kind: 'import', label: 'Importar' },
      projectKey: key,
    });
  }

  return issues;
}
