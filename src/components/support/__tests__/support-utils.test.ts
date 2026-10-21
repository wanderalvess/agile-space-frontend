import { describe, expect, it } from 'vitest';
import { SupportApiError, type SupportTicket, type SupportTicketReply } from '../../../app/support/api';
import {
  actionErrorCopy,
  buildTimeline,
  canSendNew,
  canSendReply,
  filterMine,
  formHint,
  hasUnread,
  listMeta,
  mergeTicket,
  mineCounts,
  typeInfoOf,
  whenLabel,
  withReadMark,
} from '../support-utils';
import { protocolOf, ticketKind } from '../../admin/tickets/ticket-utils';

const t = (over: Partial<SupportTicket>): SupportTicket => ({
  id: '8f3a1c2d-0000-0000-0000-000000000000',
  subject: 'Cronograma não carrega a sprint atual',
  message: 'Aparece "Nenhuma sprint ativa".',
  status: 'OPEN',
  requesterId: 'u1',
  createdAt: '2026-10-15T09:41:00Z',
  ...over,
});

const reply = (over: Partial<SupportTicketReply>): SupportTicketReply => ({
  id: 'r1',
  ticketId: 't1',
  isAdmin: true,
  message: 'Já corrigimos.',
  createdAt: '2026-10-16T09:12:00Z',
  ...over,
});

describe('suporte do usuário: tipo e protocolo', () => {
  it('usa o campo type; sem ele, cai no prefixo embutido no assunto; sem os dois, é Suporte', () => {
    expect(typeInfoOf(t({ type: 'bug', subject: 'Fila parou' })).label).toBe('Bug/Erro');
    expect(typeInfoOf(t({ type: null, subject: '[Sugestão] Exportar CSV' })).label).toBe('Sugestão');
    expect(typeInfoOf(t({ subject: 'Sem prefixo' })).label).toBe('Suporte');
    expect(ticketKind(t({ type: 'feedback', subject: 'Ficou ótimo' }))).toEqual({ type: 'Elogio', title: 'Ficou ótimo' });
    expect(ticketKind(t({ subject: '[Bug/Erro] Fila parou' }))).toEqual({ type: 'Bug/Erro', title: 'Fila parou' });
  });

  it('mostra o protocolo do servidor; sem ele deriva do id, igual ao backend', () => {
    expect(protocolOf(t({ protocol: 'SUP-0042' }))).toBe('SUP-0042');
    expect(protocolOf(t({ protocol: null }))).toBe('SUP-8F3A1C2D');
    expect(protocolOf(t({ protocol: '  ' }))).toBe('SUP-8F3A1C2D');
  });
});

describe('suporte do usuário: lista', () => {
  const list = [
    t({ id: 'a', createdAt: '2026-10-10T10:00:00Z', status: 'CLOSED', subject: 'Esqueci a senha', protocol: 'SUP-0038' }),
    t({ id: 'b', createdAt: '2026-10-15T09:00:00Z', status: 'OPEN', subject: 'Cronograma vazio', protocol: 'SUP-0042' }),
    t({ id: 'c', createdAt: '2026-10-13T11:30:00Z', status: 'IN_PROGRESS', subject: 'Convidar pessoa de outra squad', protocol: 'SUP-0040' }),
  ];

  it('conta Todos, Abertos (aberto + em andamento) e Fechados', () => {
    expect(mineCounts(list)).toEqual({ all: 3, open: 2, closed: 1 });
  });

  it('filtra por estado e busca por assunto ou protocolo, sem acento, mais novos primeiro', () => {
    expect(filterMine(list, { filter: 'all', query: '' }).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(filterMine(list, { filter: 'open', query: '' }).map((x) => x.id)).toEqual(['b', 'c']);
    expect(filterMine(list, { filter: 'closed', query: '' }).map((x) => x.id)).toEqual(['a']);
    expect(filterMine(list, { filter: 'all', query: 'sup-0040' }).map((x) => x.id)).toEqual(['c']);
    expect(filterMine(list, { filter: 'all', query: 'SENHA' }).map((x) => x.id)).toEqual(['a']);
    expect(filterMine(list, { filter: 'open', query: 'senha' })).toEqual([]);
  });

  it('não lida: hasUnreadReply ou contagem; servidor antigo (sem campos) nunca marca', () => {
    expect(hasUnread(t({ hasUnreadReply: true }))).toBe(true);
    expect(hasUnread(t({ unreadReplies: 2 }))).toBe(true);
    expect(hasUnread(t({ unreadReplies: 0 }))).toBe(false);
    expect(hasUnread(t({}))).toBe(false);
    expect(hasUnread(withReadMark(t({ hasUnreadReply: true, unreadReplies: 3 })))).toBe(false);
  });

  it('troca o chamado atualizado sem perder campos', () => {
    const merged = mergeTicket(list, { ...list[1], status: 'CLOSED' });
    expect(merged[1]).toMatchObject({ id: 'b', status: 'CLOSED', subject: 'Cronograma vazio', protocol: 'SUP-0042' });
    expect(merged[0]).toBe(list[0]);
  });

  it('linha de apoio: tipo e quando mexeram', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(listMeta(t({ status: 'CLOSED', type: 'support', updatedAt: '2026-10-03T09:00:00Z' }), now)).toBe('Suporte · fechado 03/10');
    expect(listMeta(t({ type: 'bug', updatedAt: '2026-10-02T09:00:00Z' }), now)).toMatch(/^Bug\/Erro · atualizado 02\/10, \d{2}:\d{2}$/);
  });

  it('data sem fuso do servidor vale UTC e data inválida some', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    // sem fuso = UTC: 12:00Z é o mesmo instante com e sem o "Z", em qualquer fuso do computador
    expect(whenLabel('2026-10-02T12:00:00', now)).toBe(whenLabel('2026-10-02T12:00:00Z', now));
    expect(whenLabel('2026-10-02T12:00:00', now)).toMatch(/^02\/10, \d{2}:\d{2}$/);
    expect(whenLabel('lixo', now)).toBe('');
    expect(whenLabel(undefined, now)).toBe('');
  });
});

describe('suporte do usuário: conversa', () => {
  it('começa pelo relato, segue com as respostas na ordem e o time aparece como Suporte', () => {
    const items = buildTimeline(t({ message: 'Relato' }), [reply({ id: 'r1', message: 'Time' }), reply({ id: 'r2', isAdmin: false, message: 'Eu' })]);
    expect(items.map((i) => (i.kind === 'message' ? [i.name, i.mine, i.text] : ['evento']))).toEqual([
      ['Você', true, 'Relato'],
      ['Suporte', false, 'Time'],
      ['Você', true, 'Eu'],
    ]);
  });

  it('aceita o campo admin quando o Jackson não manda isAdmin', () => {
    const items = buildTimeline(t({}), [{ ...reply({}), isAdmin: undefined as unknown as boolean, admin: true }]);
    expect(items[1]).toMatchObject({ name: 'Suporte', mine: false });
  });

  it('chamado fechado termina com a marca de fechamento', () => {
    const items = buildTimeline(t({ status: 'CLOSED', updatedAt: '2026-10-03T09:00:00Z' }), []);
    expect(items.at(-1)).toMatchObject({ kind: 'event', text: 'Chamado fechado' });
    expect(buildTimeline(t({ status: 'OPEN' }), []).some((i) => i.kind === 'event')).toBe(false);
  });
});

describe('suporte do usuário: formulário e erros', () => {
  it('só envia com assunto e descrição preenchidos e fora do envio', () => {
    expect(canSendNew({ subject: ' ', message: 'x', sending: false })).toBe(false);
    expect(canSendNew({ subject: 'a', message: '  ', sending: false })).toBe(false);
    expect(canSendNew({ subject: 'a', message: 'x', sending: true })).toBe(false);
    expect(canSendNew({ subject: 'a', message: 'x', sending: false })).toBe(true);
    expect(canSendNew({ subject: 'a'.repeat(201), message: 'x', sending: false })).toBe(false);
    expect(formHint({ subject: '', message: '' })).toContain('Preencha');
    expect(formHint({ subject: 'a', message: 'b' })).toContain('protocolo');
  });

  it('resposta vazia ou longa demais não envia', () => {
    expect(canSendReply({ draft: '  ', sending: false })).toBe(false);
    expect(canSendReply({ draft: 'ok', sending: false })).toBe(true);
    expect(canSendReply({ draft: 'x'.repeat(8001), sending: false })).toBe(false);
  });

  it('409 ao responder explica que o chamado está fechado; falha comum mantém o texto', () => {
    expect(actionErrorCopy(new SupportApiError(409), 'reply').description).toContain('Reabra');
    expect(actionErrorCopy(new SupportApiError(404), 'close').title).toBe('Chamado não encontrado');
    expect(actionErrorCopy(new Error('rede'), 'create').description).toContain('foi mantido');
  });
});
