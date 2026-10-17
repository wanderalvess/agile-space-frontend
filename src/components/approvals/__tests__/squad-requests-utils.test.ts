import { describe, expect, it } from 'vitest';
import type { ApprovalAccess, SquadLinkRequest } from '../../../lib/squad-link-requests-api';
import {
  NOTE_CANNOT,
  NOTE_LEADERSHIP,
  NOTE_SELF,
  approveEffect,
  decisionAbility,
  needsRowPick,
  requestDetail,
  resolveRosterTab,
} from '../squad-requests-utils';

const am: ApprovalAccess = { canApprove: true, canApproveLeadership: false };
const peopleLead: ApprovalAccess = { canApprove: true, canApproveLeadership: true };
const none: ApprovalAccess = { canApprove: false, canApproveLeadership: false };

const req = (over: Partial<SquadLinkRequest> = {}): SquadLinkRequest => ({
  id: 'r1',
  requester: { id: 'u1', name: 'Ana Paula', email: 'ana@totvs.com.br' },
  projectKey: 'DDWMISSI',
  kind: 'CONTRIBUTOR',
  requestedRoleName: 'Developer',
  emailInJira: 'ana.n@totvs.com.br',
  status: 'PENDING',
  createdAt: '2026-10-17T12:00:00Z',
  ...over,
});

describe('resolveRosterTab (?tab=pedidos)', () => {
  it('sem o parâmetro (ou com outro valor) abre o Time', () => {
    expect(resolveRosterTab(null, am, true)).toBe('time');
    expect(resolveRosterTab('qualquer', am, true)).toBe('time');
    expect(resolveRosterTab(null, none, false)).toBe('time');
  });

  it('?tab=pedidos abre Pedidos para quem aprova', () => {
    expect(resolveRosterTab('pedidos', am, true)).toBe('pedidos');
  });

  it('?tab=pedidos espera a permissão carregar (sem piscar o Time nem dar erro)', () => {
    expect(resolveRosterTab('pedidos', none, false)).toBeNull();
  });

  it('?tab=pedidos sem poder aprovar (mais) cai no Time, sem erro', () => {
    expect(resolveRosterTab('pedidos', none, true)).toBe('time');
  });
});

describe('decisionAbility (nunca mostrar botão que o servidor recusa)', () => {
  it('contribuidor: quem aprova vê Aprovar e Recusar', () => {
    expect(decisionAbility(req(), am, 'u-me')).toEqual({ approve: true, reject: true, note: null });
  });

  it('liderança sem canApproveLeadership: nenhum botão e o motivo', () => {
    expect(decisionAbility(req({ kind: 'LEADERSHIP' }), am, 'u-me')).toEqual({ approve: false, reject: false, note: NOTE_LEADERSHIP });
    expect(NOTE_LEADERSHIP).toBe('Só People Lead ou Tribe Lead aprovam liderança');
  });

  it('liderança com canApproveLeadership: botões', () => {
    expect(decisionAbility(req({ kind: 'LEADERSHIP', memberId: 'm1' }), peopleLead, 'u-me')).toMatchObject({ approve: true, reject: true });
  });

  it('o próprio pedido nunca é decidido pela própria pessoa', () => {
    expect(decisionAbility(req(), peopleLead, 'u1')).toEqual({ approve: false, reject: false, note: NOTE_SELF });
  });

  it('canDecide=false do servidor desliga os botões', () => {
    expect(decisionAbility(req({ canDecide: false }), am, 'u-me')).toEqual({ approve: false, reject: false, note: NOTE_CANNOT });
    expect(decisionAbility(req({ canDecide: false, kind: 'LEADERSHIP' }), peopleLead, 'u-me').approve).toBe(false);
  });

  it('pedido sem linha e sem papel também se aprova (quem aprova escolhe a linha)', () => {
    const old = req({ requestedRoleName: undefined });
    expect(needsRowPick(old)).toBe(true);
    expect(decisionAbility(old, am, 'u-me')).toEqual({ approve: true, reject: true, note: null });
    expect(needsRowPick(req({ requestedRoleName: undefined, memberId: 'm1' }))).toBe(false);
    expect(needsRowPick(req())).toBe(false);
  });
});

describe('textos do pedido', () => {
  it('o efeito da aprovação diz quem passa a ter acesso e com que papel', () => {
    expect(approveEffect(req())).toBe('Ana Paula passa a ter acesso à squad como Developer.');
    expect(approveEffect(req({ requestedRoleName: undefined }))).toMatch(/Escolha com quem ligar a conta/);
    expect(approveEffect(req({ requestedRoleName: undefined, memberName: 'Ana P.' }))).toBe('Ana Paula passa a ter acesso à squad na linha “Ana P.” do time.');
  });

  it('o detalhe mostra a linha pedida, o e-mail do Jira e a mensagem', () => {
    expect(requestDetail(req({ memberName: 'Ana P.', message: 'oi' }))).toBe('Pede para assumir a linha “Ana P.” do time. E-mail no Jira: ana.n@totvs.com.br. “oi”');
    expect(requestDetail(req())).toBe('Não aparece na lista do time. E-mail no Jira: ana.n@totvs.com.br.');
  });
});
