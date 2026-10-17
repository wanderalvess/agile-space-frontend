import { describe, it, expect } from 'vitest';
import type { SupportTicket } from '@/app/support/api';
import {
  canSubmit,
  emptyTicketsCopy,
  filterTickets,
  replyIsAdmin,
  replyKindLabel,
  splitSubject,
  statusCounts,
  statusMeta,
  submitLabel,
  ticketCode,
} from '../ticket-utils';

const t = (over: Partial<SupportTicket>): SupportTicket => ({
  id: '8f3a1c2d-0000-0000-0000-000000000000',
  subject: '[Bug/Erro] Fila do Poker não atualiza',
  message: 'Depois que todos votam, a tela continua em Aguardando.',
  status: 'OPEN',
  requesterId: 'u1',
  requesterName: 'Ana Ribeiro',
  requesterEmail: 'ana.ribeiro@totvs.com.br',
  createdAt: '2026-10-15T09:41:00',
  ...over,
});

const list = [
  t({ id: 'a1', createdAt: '2026-10-10T10:00:00', status: 'CLOSED', subject: '[Elogio] Poker ficou rápido', requesterName: 'Gabriela' }),
  t({ id: 'b2', createdAt: '2026-10-15T09:00:00', status: 'OPEN' }),
  t({ id: 'c3', createdAt: '2026-10-13T11:30:00', status: 'IN_PROGRESS', subject: 'Sem prefixo', requesterEmail: 'diego@totvs.com.br' }),
];

describe('chamados (admin)', () => {
  it('mostra o código como #ID de 8 caracteres em maiúsculas', () => {
    expect(ticketCode('8f3a1c2d-0000-0000-0000-000000000000')).toBe('#8F3A1C2D');
  });

  it('separa o tipo do prefixo do assunto; sem prefixo o tipo é Suporte', () => {
    expect(splitSubject('[Bug/Erro] Fila não atualiza')).toEqual({ type: 'Bug/Erro', title: 'Fila não atualiza' });
    expect(splitSubject('[Sugestão] Exportar em PDF')).toEqual({ type: 'Sugestão', title: 'Exportar em PDF' });
    expect(splitSubject('Trocar o e-mail')).toEqual({ type: 'Suporte', title: 'Trocar o e-mail' });
    expect(splitSubject('[Elogio]')).toEqual({ type: 'Elogio', title: '[Elogio]' });
  });

  it('traduz o status para o português e cai no texto cru se for desconhecido', () => {
    expect(statusMeta('OPEN').label).toBe('Aberto');
    expect(statusMeta('IN_PROGRESS').label).toBe('Em andamento');
    expect(statusMeta('CLOSED').label).toBe('Resolvido');
    expect(statusMeta('OPEN').userSees).toBe('Em análise');
    expect(statusMeta('IN_PROGRESS').userSees).toBe('Processando');
    expect(statusMeta('ARCHIVED').label).toBe('ARCHIVED');
  });

  it('conta por status sobre a lista inteira', () => {
    expect(statusCounts(list)).toEqual({ all: 3, OPEN: 1, IN_PROGRESS: 1, CLOSED: 1 });
    expect(statusCounts([])).toEqual({ all: 0, OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 });
  });

  it('filtra por status e busca (sem acento), mais novos primeiro', () => {
    expect(filterTickets(list, { status: 'all', query: '' }).map((x) => x.id)).toEqual(['b2', 'c3', 'a1']);
    expect(filterTickets(list, { status: 'IN_PROGRESS', query: '' }).map((x) => x.id)).toEqual(['c3']);
    expect(filterTickets(list, { status: 'all', query: 'ATUALIZA' }).map((x) => x.id)).toEqual(['b2']);
    expect(filterTickets(list, { status: 'all', query: 'diego@' }).map((x) => x.id)).toEqual(['c3']);
    expect(filterTickets(list, { status: 'all', query: 'gabriela' }).map((x) => x.id)).toEqual(['a1']);
    expect(filterTickets(list, { status: 'all', query: '#B2' }).map((x) => x.id)).toEqual(['b2']);
    expect(filterTickets(list, { status: 'CLOSED', query: 'diego' })).toEqual([]);
  });

  it('rotula a resposta pelo isAdmin, não tudo como governança', () => {
    expect(replyKindLabel(true)).toBe('Resposta da governança');
    expect(replyKindLabel(false)).toBe('Resposta do solicitante');
  });

  it('aceita isAdmin ou admin (nome que o Jackson gera para o getter do Lombok)', () => {
    expect(replyIsAdmin({ isAdmin: true })).toBe(true);
    expect(replyIsAdmin({ isAdmin: false, admin: true })).toBe(false);
    expect(replyIsAdmin({ admin: true } as never)).toBe(true);
    expect(replyIsAdmin({} as never)).toBe(false);
  });

  it('o botão muda de rótulo conforme o que será enviado', () => {
    const l = (hasDraft: boolean, statusChanged: boolean, sending = false) => submitLabel({ hasDraft, statusChanged, sending });
    expect(l(false, false)).toBe('Atualizar chamado');
    expect(l(true, false)).toBe('Enviar resposta');
    expect(l(false, true)).toBe('Salvar status');
    expect(l(true, true)).toBe('Enviar e salvar status');
    expect(l(true, true, true)).toBe('Enviando…');
  });

  it('só envia com texto ou status novo, até 8000 caracteres', () => {
    expect(canSubmit({ draft: '', statusChanged: false, sending: false })).toBe(false);
    expect(canSubmit({ draft: '   ', statusChanged: false, sending: false })).toBe(false);
    expect(canSubmit({ draft: 'Oi', statusChanged: false, sending: false })).toBe(true);
    expect(canSubmit({ draft: '', statusChanged: true, sending: false })).toBe(true);
    expect(canSubmit({ draft: 'Oi', statusChanged: true, sending: true })).toBe(false);
    expect(canSubmit({ draft: 'x'.repeat(8001), statusChanged: false, sending: false })).toBe(false);
    expect(canSubmit({ draft: 'x'.repeat(8000), statusChanged: false, sending: false })).toBe(true);
  });

  it('texto do vazio: sem chamados, busca sem resultado ou status sem chamados', () => {
    expect(emptyTicketsCopy({ total: 0, status: 'all', query: '' })).toMatchObject({ title: 'Nenhum chamado ainda', canClear: false });
    expect(emptyTicketsCopy({ total: 8, status: 'IN_PROGRESS', query: '' })).toMatchObject({ title: 'Nenhum chamado em andamento', canClear: true });
    expect(emptyTicketsCopy({ total: 8, status: 'all', query: 'zzz' })).toMatchObject({ title: 'Nenhum chamado encontrado', canClear: true });
  });
});
