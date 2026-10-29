import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantList } from '../ParticipantList';
import type { Participant } from '@/lib/types';

const p = (id: string, over: Partial<Participant> = {}): Participant =>
  ({ id, roomId: 'r1', nickname: id, role: 'dev', isFacilitator: false, ...over }) as Participant;

const base = {
  votes: [],
  currentUserId: 'b',
  isFacilitator: false,
  onRemoveParticipant: vi.fn(),
  onUpdateParticipantRole: vi.fn(),
  onClaimFacilitator: vi.fn(),
};

afterEach(cleanup);

describe('ParticipantList: assumir o controle', () => {
  const people = [p('a', { isFacilitator: true, role: 'organizador' }), p('b')];

  it('com o organizador online o botão não aparece', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['a', 'b'])} />);
    expect(screen.queryByLabelText('Assumir o controle da sala')).toBeNull();
  });

  it('com o organizador ausente o botão aparece', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['b'])} />);
    expect(screen.getByLabelText('Assumir o controle da sala')).toBeTruthy();
  });
});

describe('ParticipantList: cargo por extenso e observadores', () => {
  const people = [
    p('dev', { globalRole: 'Desenvolvedor(a)', nickname: 'Davi' }),
    p('tl', { role: 'organizador', globalRole: 'Tech Lead', nickname: 'Tati' }),
    p('sem', { globalRole: undefined, nickname: 'Sam' }),
  ];

  it('mostra o cargo da administração por extenso, ou "Sem cargo", nunca a sigla da categoria', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['dev', 'tl', 'sem'])} />);
    expect(screen.getAllByText('Desenvolvedor(a)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tech Lead').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sem cargo').length).toBeGreaterThan(0);
    // Cada pessoa mostra o cargo, não um rótulo inventado pelo papel na sala.
    expect(screen.queryByText('Organizador')).toBeNull();
    expect(screen.queryByText('Desenvolvedor')).toBeNull();
  });

  it('cargo que não vota e quem está sem cargo aparecem como observando, com o motivo', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['dev', 'tl', 'sem'])} />);
    expect(screen.getByLabelText('Observando · cargo não vota nesta sala')).toBeTruthy();
    expect(screen.getByLabelText('Observando · sem cargo na administração')).toBeTruthy();
    expect(screen.getAllByLabelText('Pensando')).toHaveLength(1);
  });

  it('incluir o cargo em "Quem vota" tira o aviso e o põe a pensar', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['dev', 'tl', 'sem'])} votingCargos={['Desenvolvedor(a)', 'Tech Lead']} />);
    expect(screen.queryByLabelText('Observando · cargo não vota nesta sala')).toBeNull();
    expect(screen.getAllByLabelText('Pensando')).toHaveLength(2);
  });

  it('voto de quem saiu mostra o cargo congelado no voto', () => {
    render(
      <ParticipantList
        {...base}
        participants={[people[0]]}
        votes={[{ id: 'v', participantId: 'gone', roomId: 'r1', value: '5', timestamp: '', participantNickname: 'Gui', participantRole: 'qa', participantGlobalRole: 'Analista de QA' }]}
      />
    );
    expect(screen.getByText('Analista de QA')).toBeTruthy();
  });
});

describe('ParticipantList: grupos pelo cargo da administração', () => {
  it('quem está sem cargo não entra em DEV só porque a sala o registrou como dev: vai para "Sem cargo"', () => {
    const people = [
      p('dev', { globalRole: 'Desenvolvedor(a)', nickname: 'Davi' }),
      p('sem', { globalRole: undefined, nickname: 'Sam' }),
    ];
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['dev', 'sem'])} />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/DEV\s*1/);
    expect(text).not.toMatch(/DEV\s*2/);
    expect(screen.getAllByText('Sem cargo').length).toBeGreaterThanOrEqual(2); // grupo + cargo ao lado do nome
  });
});
