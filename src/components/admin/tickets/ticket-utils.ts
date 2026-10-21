import type { SupportTicket, SupportTicketReply, SupportTicketStatus, SupportTicketType } from '@/app/support/api';
import type { Tone } from '@/components/room-kit';

/** Máximo de caracteres de uma resposta (SupportTicketService.addReply). */
export const MAX_REPLY_LENGTH = 8000;

export const TICKET_STATUSES: readonly SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED'];

interface StatusMeta {
  label: string;
  tone: Tone;
  /** O que a pessoa que abriu o chamado vê na tela de Suporte (mesmo rótulo do admin). */
  userSees: string;
}

export const STATUS_META: Record<SupportTicketStatus, StatusMeta> = {
  OPEN: { label: 'Aberto', tone: 'danger', userSees: 'Aberto' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'warn', userSees: 'Em andamento' },
  CLOSED: { label: 'Resolvido', tone: 'success', userSees: 'Resolvido' },
};

/** Status desconhecido (servidor novo) aparece como o texto cru, sem quebrar a lista. */
export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as SupportTicketStatus] ?? { label: status, tone: 'neutral', userSees: status };
}

export type TicketFilter = 'all' | SupportTicketStatus;

/** "#8F3A1C2D": os 8 primeiros caracteres do id, em maiúsculas. */
export function ticketCode(id: string): string {
  return `#${id.substring(0, 8).toUpperCase()}`;
}

/** O assunto é gravado como "[Bug/Erro] texto": separa o tipo (coluna Tipo) do título. Sem prefixo o tipo é "Suporte". */
export function splitSubject(subject: string): { type: string; title: string } {
  const m = /^\s*\[([^\]]{1,24})\]\s*(.*)$/.exec(subject);
  if (!m) return { type: 'Suporte', title: subject.trim() };
  return { type: m[1].trim(), title: m[2].trim() || subject.trim() };
}

/** Rótulo de cada tipo (o mesmo dos cartões da tela de Suporte). */
export const TICKET_TYPE_LABEL: Record<SupportTicketType, string> = {
  support: 'Suporte',
  bug: 'Bug/Erro',
  suggestion: 'Sugestão',
  feedback: 'Elogio',
};

/**
 * Tipo e título do chamado. Com o campo `type` (servidor novo) o assunto já vem limpo; sem ele (chamado antigo ou
 * servidor antigo) o tipo vem do prefixo embutido no assunto ("[Bug/Erro] texto").
 */
export function ticketKind(ticket: Pick<SupportTicket, 'subject' | 'type'>): { type: string; title: string } {
  const label = ticket.type ? TICKET_TYPE_LABEL[ticket.type] : undefined;
  if (label) return { type: label, title: ticket.subject.trim() };
  return splitSubject(ticket.subject);
}

/** Protocolo SUP-NNNN do servidor; sem ele (servidor antigo) deriva do id, igual ao backend: "SUP-" + 8 primeiros hex. */
export function protocolOf(ticket: Pick<SupportTicket, 'id' | 'protocol'>): string {
  const stored = ticket.protocol?.trim();
  if (stored) return stored;
  return `SUP-${ticket.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
}

/** Contagem por status sobre a lista inteira (os filtros mostram o número de cada um). */
export function statusCounts(tickets: Pick<SupportTicket, 'status'>[]): Record<TicketFilter, number> {
  const counts: Record<TicketFilter, number> = { all: tickets.length, OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 };
  for (const t of tickets) if (t.status in counts) counts[t.status as SupportTicketStatus] += 1;
  return counts;
}

const norm = (v?: string | null) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por status e busca (assunto, texto, nome, e-mail e código), sem acento nem caixa. Mais novos primeiro. */
export function filterTickets(tickets: SupportTicket[], opts: { status: TicketFilter; query: string }): SupportTicket[] {
  const q = norm(opts.query.trim());
  return tickets
    .filter((t) => {
      if (opts.status !== 'all' && t.status !== opts.status) return false;
      if (!q) return true;
      return [t.subject, t.message, t.requesterName, t.requesterEmail, ticketCode(t.id), protocolOf(t)].some((f) => norm(f).includes(q));
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** A resposta é da governança? O backend (Lombok + Jackson) pode mandar `admin` em vez de `isAdmin`: aceita os dois. */
export function replyIsAdmin(r: Pick<SupportTicketReply, 'isAdmin' | 'admin'>): boolean {
  return r.isAdmin ?? r.admin ?? false;
}

/** Rótulo da resposta: a da governança (`isAdmin`) ou a de quem abriu o chamado. */
export function replyKindLabel(isAdmin: boolean): string {
  return isAdmin ? 'Resposta da governança' : 'Resposta do solicitante';
}

/** Rótulo dinâmico do botão do compositor, conforme o que será enviado. */
export function submitLabel(opts: { hasDraft: boolean; statusChanged: boolean; sending: boolean }): string {
  if (opts.sending) return 'Enviando…';
  if (opts.hasDraft && opts.statusChanged) return 'Enviar e salvar status';
  if (opts.hasDraft) return 'Enviar resposta';
  if (opts.statusChanged) return 'Salvar status';
  return 'Atualizar chamado';
}

/** O botão só vale com texto ou com status diferente do atual. */
export function canSubmit(opts: { draft: string; statusChanged: boolean; sending: boolean }): boolean {
  return !opts.sending && (opts.draft.trim().length > 0 || opts.statusChanged) && opts.draft.length <= MAX_REPLY_LENGTH;
}

/** Texto do vazio: sem chamados ainda, ou filtro/busca sem resultado. */
export function emptyTicketsCopy(opts: { total: number; status: TicketFilter; query: string }): { title: string; description: string; canClear: boolean } {
  if (opts.total === 0) {
    return { title: 'Nenhum chamado ainda', description: 'Quando alguém abrir um chamado na Central de Suporte, ele aparece aqui', canClear: false };
  }
  if (opts.query.trim() && opts.status === 'all') {
    return { title: 'Nenhum chamado encontrado', description: 'Tente outro trecho do assunto, do nome ou do e-mail', canClear: true };
  }
  if (opts.query.trim()) {
    return { title: 'Nenhum chamado encontrado', description: 'Tente outro trecho ou veja todos os status', canClear: true };
  }
  return {
    title: `Nenhum chamado ${statusMeta(opts.status).label.toLowerCase()}`,
    description: 'Os outros status continuam disponíveis nos filtros acima',
    canClear: true,
  };
}
