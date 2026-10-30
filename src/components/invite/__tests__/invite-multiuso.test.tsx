import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InviteAcceptView } from '../InviteAcceptView';
import type { InvitePreview } from '../../../lib/invite-api';

const team: InvitePreview = {
  squadId: 'SQ',
  squadName: 'Squad Alfa',
  roleName: 'Developer',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  emailMasked: null,
  multiUse: true,
  remainingUses: 7,
};

const common = { error: null, accepting: false, onAccept: vi.fn(), onSwitchAccount: vi.fn(), onSkip: vi.fn() };

describe('página do convite de equipe', () => {
  it('visitante vê a squad e as vagas restantes, sem aceitar', () => {
    render(<InviteAcceptView {...common} view="visitante" invite={team} onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.getByText('Convite para a squad Squad Alfa')).toBeTruthy();
    expect(screen.getAllByText(/7 vagas restantes/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Aceitar Convite')).toBeNull();
    expect(screen.getByText('Criar conta e aceitar')).toBeTruthy();
  });

  it('logado vê as vagas e aceita com um clique', () => {
    const onAccept = vi.fn();
    render(<InviteAcceptView {...common} onAccept={onAccept} view="normal" invite={{ ...team, remainingUses: 1 }} email="ana@totvs.com.br" />);
    expect(screen.getAllByText(/1 vaga restante/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Aceitar Convite'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('sem limite de pessoas', () => {
    render(<InviteAcceptView {...common} view="normal" invite={{ ...team, remainingUses: null }} email="ana@totvs.com.br" />);
    expect(screen.getAllByText(/sem limite de pessoas/).length).toBeGreaterThan(0);
  });

  it('esgotado mostra a mensagem combinada', () => {
    render(<InviteAcceptView {...common} view="esgotado" invite={{ ...team, status: 'EXHAUSTED', remainingUses: 0 }} />);
    expect(screen.getByText('Convite esgotado')).toBeTruthy();
    expect(screen.getByText('Este convite atingiu o limite de pessoas. Peça um novo link a quem convidou.')).toBeTruthy();
  });

  it('expirado e revogado', () => {
    const { unmount } = render(<InviteAcceptView {...common} view="expirado" invite={{ ...team, status: 'EXPIRED' }} />);
    expect(screen.getByText(/expirou/)).toBeTruthy();
    unmount();
    render(<InviteAcceptView {...common} view="cancelado" invite={{ ...team, status: 'REVOKED' }} />);
    expect(screen.getByText(/cancelado por quem o enviou/)).toBeTruthy();
  });

  it('já é membro: avisa e leva à squad sem aceitar', () => {
    const onGoSquad = vi.fn();
    const onAccept = vi.fn();
    render(<InviteAcceptView {...common} onAccept={onAccept} onGoSquad={onGoSquad} view="ja-membro" invite={{ ...team, alreadyMember: true }} email="ana@totvs.com.br" />);
    expect(screen.getByText('Você já faz parte desta squad')).toBeTruthy();
    expect(screen.queryByText('Aceitar Convite')).toBeNull();
    fireEvent.click(screen.getByText('Ir para a squad'));
    expect(onGoSquad).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
