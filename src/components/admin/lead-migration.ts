import type { LeadDemotionReport, LeadRestoreReport, LeadUser } from '@/lib/lead-demotion-api';

/** Plural simples: `plural(1, 'conta')` = "1 conta", `plural(2, 'conta')` = "2 contas". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Contas que o "Rebaixar os seguros" mexeria agora (têm vínculo de liderança), limitadas ao lote do servidor. */
export function safeToDemote(report: LeadDemotionReport | null): LeadUser[] {
  if (!report) return [];
  return report.users.filter((u) => u.classification === 'HAS_LEADERSHIP_LINK' && (u.action === 'WOULD_DEMOTE' || u.action === 'WOULD_DEMOTE_FORCED'));
}

/** Contas sem liderança por vínculo: só saem do LEAD de propósito, uma a uma. */
export function withoutLeadership(report: LeadDemotionReport | null): LeadUser[] {
  return report ? report.users.filter((u) => u.classification === 'NO_LEADERSHIP_LINK') : [];
}

/** "2 contas com vínculo de liderança · 1 sem". */
export function migrationHeadline(report: LeadDemotionReport): string {
  const s = report.summary;
  return `${plural(s.leadUsers, 'conta')} com o nível LEAD · ${s.hasLeadershipLink} com vínculo de liderança · ${s.noLeadershipLink} sem`;
}

export const CLASSIFICATION_LABEL: Record<LeadUser['classification'], string> = {
  HAS_LEADERSHIP_LINK: 'Tem vínculo de liderança',
  NO_LEADERSHIP_LINK: 'Sem liderança por vínculo',
};

/** O que o servidor fez ou faria com a conta; valor novo do servidor vira `null` (a linha não mostra o selo). */
export function actionLabel(action: string): { label: string; tone: 'success' | 'warn' | 'neutral' | 'brand' } | null {
  switch (action) {
    case 'WOULD_DEMOTE':
      return { label: 'Pode rebaixar', tone: 'success' };
    case 'WOULD_DEMOTE_FORCED':
      return { label: 'Seria rebaixada (forçado)', tone: 'warn' };
    case 'DEMOTED':
      return { label: 'Rebaixada', tone: 'success' };
    case 'DEMOTED_FORCED':
      return { label: 'Rebaixada (forçado)', tone: 'warn' };
    case 'KEPT_NO_LEADERSHIP_LINK':
      return { label: 'Fica como está', tone: 'neutral' };
    case 'OVER_LIMIT':
      return { label: 'Próximo lote', tone: 'brand' };
    default:
      return null;
  }
}

/** Texto do aviso depois de aplicar um lote. */
export function appliedMessage(report: LeadDemotionReport): string {
  const n = report.summary.demoted;
  if (n === 0) return 'Nenhuma conta foi rebaixada.';
  const base = n === 1 ? '1 conta virou Membro.' : `${n} contas viraram Membro.`;
  return report.summary.overLimit > 0 ? `${base} ${plural(report.summary.overLimit, 'conta')} ficaram para o próximo lote.` : base;
}

/** Texto do aviso depois de restaurar. */
export function restoredMessage(report: LeadRestoreReport): string {
  if (report.restored === 0) return report.skipped > 0 ? `Nada restaurado: ${plural(report.skipped, 'conta')} não precisava.` : 'Nada para restaurar.';
  const base = report.restored === 1 ? '1 conta voltou ao nível LEAD.' : `${report.restored} contas voltaram ao nível LEAD.`;
  return report.skipped > 0 ? `${base} ${plural(report.skipped, 'conta')} ignorada${report.skipped === 1 ? '' : 's'}.` : base;
}

/** Link do roster da squad, onde se cria o vínculo; sem squad conhecida não há link. */
export function rosterHref(squadId?: string | null): string | null {
  const id = (squadId || '').trim();
  return id ? `/squad/roster?squadId=${encodeURIComponent(id)}` : null;
}

/** Nome para a tela: nome, senão e-mail, senão id. */
export function leadUserLabel(u: Pick<LeadUser, 'name' | 'email' | 'userId'>): string {
  return u.name?.trim() || u.email?.trim() || u.userId;
}
