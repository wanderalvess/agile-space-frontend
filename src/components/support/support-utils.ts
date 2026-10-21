import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bug, Lightbulb, LifeBuoy, MessageSquareHeart, type LucideIcon } from 'lucide-react';
import { SupportApiError, type SupportTicket, type SupportTicketReply, type SupportTicketType } from '@/app/support/api';
import { protocolOf, replyIsAdmin, ticketKind } from '@/components/admin/tickets/ticket-utils';
import { parseServerDate } from '@/lib/server-time';

/** Limites do servidor (SupportTicketService). */
export const MAX_SUBJECT = 200;
export const MAX_MESSAGE = 8000;

/** Atualização da conversa aberta e da lista: a cada ~30 s, só com a aba visível. */
export const POLL_INTERVAL_MS = 30_000;

export interface SupportTypeInfo {
  id: SupportTicketType;
  label: string;
  icon: LucideIcon;
  /** Frase do Guia ("Qual tipo escolher"). */
  description: string;
  /** Dica do campo Descrição no formulário. */
  hint: string;
}

export const SUPPORT_TYPES: readonly SupportTypeInfo[] = [
  { id: 'support', label: 'Suporte', icon: LifeBuoy, description: 'Dúvida de uso ou pedido de ajuda.', hint: 'O que você queria fazer e o que aconteceu?' },
  { id: 'bug', label: 'Bug/Erro', icon: Bug, description: 'Algo não funciona como deveria.', hint: 'Em que tela, o que você fez e qual mensagem apareceu?' },
  { id: 'suggestion', label: 'Sugestão', icon: Lightbulb, description: 'Uma ideia para melhorar o portal.', hint: 'Qual problema a ideia resolve e como você imagina?' },
  { id: 'feedback', label: 'Elogio', icon: MessageSquareHeart, description: 'Conte o que está funcionando bem.', hint: 'O que funcionou bem para você?' },
];

const TYPE_BY_LABEL = new Map(SUPPORT_TYPES.map((t) => [t.label, t]));

/** Tipo do chamado: o campo `type` ou, em chamado antigo, o prefixo embutido no assunto ("[Bug/Erro] ..."). */
export function typeInfoOf(ticket: Pick<SupportTicket, 'subject' | 'type'>): SupportTypeInfo {
  const byField = ticket.type ? SUPPORT_TYPES.find((t) => t.id === ticket.type) : undefined;
  if (byField) return byField;
  return TYPE_BY_LABEL.get(ticketKind(ticket).type) ?? SUPPORT_TYPES[0];
}

// ---------- lista ----------

export type MineFilter = 'all' | 'open' | 'closed';

export const isClosed = (t: Pick<SupportTicket, 'status'>) => t.status === 'CLOSED';

export function hasUnread(t: Pick<SupportTicket, 'hasUnreadReply' | 'unreadReplies'>): boolean {
  return t.hasUnreadReply ?? (t.unreadReplies ?? 0) > 0;
}

export function mineCounts(tickets: Pick<SupportTicket, 'status'>[]): Record<MineFilter, number> {
  const closed = tickets.filter(isClosed).length;
  return { all: tickets.length, open: tickets.length - closed, closed };
}

const norm = (v?: string | null) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtro (Todos/Abertos/Fechados) e busca por assunto ou protocolo, sem acento nem caixa. Mais novos primeiro. */
export function filterMine(tickets: SupportTicket[], opts: { filter: MineFilter; query: string }): SupportTicket[] {
  const q = norm(opts.query.trim());
  return tickets
    .filter((t) => {
      if (opts.filter === 'open' && isClosed(t)) return false;
      if (opts.filter === 'closed' && !isClosed(t)) return false;
      if (!q) return true;
      return norm(`${ticketKind(t).title} ${protocolOf(t)}`).includes(q);
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** Troca o chamado na lista pela versão nova, sem perder campos que o servidor não repetiu. */
export function mergeTicket(list: SupportTicket[], updated: SupportTicket): SupportTicket[] {
  return list.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
}

/** Marca como lido na hora (o servidor confirma em seguida). */
export function withReadMark(t: SupportTicket): SupportTicket {
  return { ...t, unreadReplies: 0, hasUnreadReply: false };
}

// ---------- datas ----------

/** "hoje, 09:12", "ontem, 16:40" ou "14/10, 11:05". Vazio se a data for inválida. */
export function whenLabel(iso?: string | null, now: Date = new Date()): string {
  const d = parseServerDate(iso);
  if (!d) return '';
  if (isToday(d)) return `hoje, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `ontem, ${format(d, 'HH:mm')}`;
  return format(d, now.getFullYear() === d.getFullYear() ? 'dd/MM, HH:mm' : 'dd/MM/yyyy, HH:mm', { locale: ptBR });
}

/** "14/10" (ou com o ano, se for de outro ano). */
export function dayLabel(iso?: string | null, now: Date = new Date()): string {
  const d = parseServerDate(iso);
  if (!d) return '';
  return format(d, now.getFullYear() === d.getFullYear() ? 'dd/MM' : 'dd/MM/yyyy', { locale: ptBR });
}

/** Linha de apoio do item da lista: tipo e quando mexeram por último. */
export function listMeta(t: SupportTicket, now: Date = new Date()): string {
  const type = typeInfoOf(t).label;
  if (isClosed(t)) {
    const day = dayLabel(t.updatedAt ?? t.createdAt, now);
    return day ? `${type} · fechado ${day}` : `${type} · fechado`;
  }
  const when = whenLabel(t.updatedAt ?? t.createdAt, now);
  return when ? `${type} · atualizado ${when}` : type;
}

// ---------- conversa ----------

export type TimelineItem =
  | { kind: 'message'; key: string; mine: boolean; name: string; when: string; text: string }
  | { kind: 'event'; key: string; when: string; text: string };

/** O time responde sempre como "Suporte" (o nome do atendimento), nunca com o nome da pessoa que respondeu. */
export const SUPPORT_NAME = 'Suporte';

/** Relato do chamado + respostas em ordem + marca de fechamento. */
export function buildTimeline(ticket: SupportTicket, replies: SupportTicketReply[], now: Date = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [
    { kind: 'message', key: `${ticket.id}:opening`, mine: true, name: 'Você', when: whenLabel(ticket.createdAt, now), text: ticket.message },
  ];
  for (const r of replies) {
    const fromTeam = replyIsAdmin(r);
    items.push({ kind: 'message', key: r.id, mine: !fromTeam, name: fromTeam ? SUPPORT_NAME : 'Você', when: whenLabel(r.createdAt, now), text: r.message });
  }
  if (isClosed(ticket)) {
    const when = whenLabel(ticket.updatedAt, now);
    items.push({ kind: 'event', key: `${ticket.id}:closed`, when, text: 'Chamado fechado' });
  }
  return items;
}

// ---------- formulário e erros ----------

export function canSendNew(opts: { subject: string; message: string; sending: boolean }): boolean {
  return !opts.sending && opts.subject.trim().length > 0 && opts.message.trim().length > 0 && opts.subject.length <= MAX_SUBJECT && opts.message.length <= MAX_MESSAGE;
}

export function formHint(opts: { subject: string; message: string }): string {
  return opts.subject.trim() && opts.message.trim() ? 'Você recebe um protocolo ao enviar.' : 'Preencha assunto e descrição para enviar.';
}

export function canSendReply(opts: { draft: string; sending: boolean }): boolean {
  return !opts.sending && opts.draft.trim().length > 0 && opts.draft.length <= MAX_MESSAGE;
}

/** Texto do aviso quando uma ação sobre o chamado falha. 409 = o estado mudou (fechado/aberto) desde a última leitura. */
export function actionErrorCopy(error: unknown, action: 'reply' | 'close' | 'reopen' | 'create'): { title: string; description: string } {
  const status = error instanceof SupportApiError ? error.status : null;
  if (status === 409 && action === 'reply') {
    return { title: 'Chamado fechado', description: 'Reabra o chamado para enviar uma nova mensagem.' };
  }
  if (status === 409 && action === 'reopen') {
    return { title: 'O chamado já está aberto', description: 'A lista foi atualizada.' };
  }
  if (status === 404) {
    return { title: 'Chamado não encontrado', description: 'Ele pode ter sido removido. Atualize a lista.' };
  }
  const titles = { reply: 'Não foi possível enviar a resposta', close: 'Não foi possível fechar o chamado', reopen: 'Não foi possível reabrir o chamado', create: 'Não foi possível enviar a solicitação' } as const;
  return { title: titles[action], description: 'Verifique sua conexão e tente de novo. O que você escreveu foi mantido.' };
}
