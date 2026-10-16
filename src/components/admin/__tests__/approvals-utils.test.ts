import { describe, expect, it } from 'vitest';
import type { PasswordResetRequest } from '@/app/admin/api';
import type { LinkRequest } from '@/lib/admin-link-requests-api';
import {
  approvalCounts,
  buildApprovalRows,
  expiryLabel,
  linkRequestDetail,
  relativeWhen,
  resetLinkFrom,
  resetStatusLabel,
  splitLinkRequests,
  splitResets,
} from '../approvals/approvals-utils';

function reset(id: string, status: PasswordResetRequest['status'], extra: Partial<PasswordResetRequest> = {}): PasswordResetRequest {
  return { id, userEmail: `${id}@totvs.com.br`, status, requestedAt: '2026-10-14T10:00:00Z', ...extra };
}

function link(id: string, status: LinkRequest['status'], extra: Partial<LinkRequest> = {}): LinkRequest {
  return {
    id,
    requester: { id: 'u1', name: 'Elisa Prado', email: 'elisa.prado@totvs.com.br' },
    projectKey: 'DDWMISSI',
    emailInJira: 'elisa.prado@parceiro.com',
    status,
    createdAt: '2026-10-15T10:00:00Z',
    ...extra,
  };
}

describe('resetLinkFrom', () => {
  it('monta o link com o token e a validade', () => {
    const l = resetLinkFrom({ resetToken: 'abc', tokenExpiresAt: '2026-10-15T17:32:00Z' }, 'carla@totvs.com.br', 'https://app.exemplo.com/');
    expect(l).toEqual({ email: 'carla@totvs.com.br', url: 'https://app.exemplo.com/reset-password?token=abc', expiresAt: '2026-10-15T17:32:00Z' });
  });

  it('sem token não há link', () => {
    expect(resetLinkFrom({}, 'a@b.c', 'https://x')).toBeNull();
  });
});

describe('expiryLabel', () => {
  it('formata "até dd/MM às HH:mm" e some sem data válida', () => {
    expect(expiryLabel('2026-10-15T14:32:00')).toBe('até 15/10 às 14:32');
    expect(expiryLabel(undefined)).toBe('');
    expect(expiryLabel('lixo')).toBe('');
  });
});

describe('resetStatusLabel', () => {
  it('traduz cada status do histórico', () => {
    expect(resetStatusLabel('COMPLETED')).toBe('Senha redefinida');
    expect(resetStatusLabel('APPROVED')).toBe('Link gerado');
    expect(resetStatusLabel('REJECTED')).toBe('Recusada');
  });
});

describe('splitResets', () => {
  it('separa pendentes e guarda só as 5 decididas mais recentes', () => {
    const all = [
      reset('p1', 'PENDING'),
      ...Array.from({ length: 7 }, (_, i) => reset(`h${i}`, 'APPROVED', { approvedAt: `2026-10-1${i}T10:00:00Z` })),
    ];
    const { pending, history } = splitResets(all);
    expect(pending.map((r) => r.id)).toEqual(['p1']);
    expect(history.map((r) => r.id)).toEqual(['h6', 'h5', 'h4', 'h3', 'h2']);
  });
});

describe('splitLinkRequests', () => {
  it('pendentes mais novos primeiro e histórico pela data da decisão', () => {
    const { pending, history } = splitLinkRequests([
      link('a', 'PENDING', { createdAt: '2026-10-14T10:00:00Z' }),
      link('b', 'PENDING', { createdAt: '2026-10-15T10:00:00Z' }),
      link('c', 'APPROVED', { decidedAt: '2026-10-13T10:00:00Z' }),
      link('d', 'REJECTED', { decidedAt: '2026-10-15T09:00:00Z' }),
    ]);
    expect(pending.map((r) => r.id)).toEqual(['b', 'a']);
    expect(history.map((r) => r.id)).toEqual(['d', 'c']);
  });
});

describe('buildApprovalRows / approvalCounts', () => {
  it('vínculos antes de redefinições, com chaves distintas', () => {
    const rows = buildApprovalRows([link('1', 'PENDING')], [reset('1', 'PENDING')]);
    expect(rows.map((r) => r.id)).toEqual(['link-1', 'reset-1']);
    expect(rows.map((r) => r.kind)).toEqual(['link', 'reset']);
  });

  it('"Todas" soma pendentes; vínculo indisponível entra como zero', () => {
    expect(approvalCounts({ links: 2, resets: 3 })).toEqual({ all: 5, links: 2, resets: 3 });
    expect(approvalCounts({ links: null, resets: 3 })).toEqual({ all: 3, links: null, resets: 3 });
    expect(approvalCounts({ links: null, resets: null }).all).toBeNull();
  });
});

describe('linkRequestDetail', () => {
  it('cita o membro do Jira, o e-mail e a conta atual', () => {
    expect(linkRequestDetail(link('1', 'PENDING', { memberName: 'Elisa P.' }))).toBe(
      'Pede vínculo com Elisa P. no Jira, e-mail elisa.prado@parceiro.com. Conta atual: elisa.prado@totvs.com.br.',
    );
  });

  it('sem membro usa só o e-mail e junta a mensagem entre aspas', () => {
    expect(linkRequestDetail(link('1', 'PENDING', { message: ' Uso o e-mail do parceiro. ' }))).toBe(
      'E-mail no Jira: elisa.prado@parceiro.com. Conta atual: elisa.prado@totvs.com.br. “Uso o e-mail do parceiro.”',
    );
  });
});

describe('relativeWhen', () => {
  it('escreve "há N minutos" e some sem data', () => {
    expect(relativeWhen('2026-10-15T09:48:00Z', new Date('2026-10-15T10:00:00Z'))).toBe('há 12 minutos');
    expect(relativeWhen(undefined)).toBe('');
  });
});
