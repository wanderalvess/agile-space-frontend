import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyLink } from '@/lib/my-links';

const h = vi.hoisted(() => ({ push: vi.fn(), toast: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('@/hooks/useMyLinkRequests', () => ({ useMyLinkRequests: () => ({ requests: [], reload: vi.fn() }) }));
vi.mock('../LinkRequestFlow', () => ({ LinkRequestFlow: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>fluxo de pedido</button> }));

import { LinksSection } from '../LinksSection';

const link = (over: Partial<MyLink>): MyLink => ({
  id: 'FLUXOTST',
  name: 'Squad Fluxo Teste',
  role: 'Analista de QA',
  roles: [{ name: 'Analista de QA', leadership: false, origin: 'Importado do Jira', primary: true }],
  scope: 'SQUAD',
  scopeLabel: null,
  origin: 'Importado do Jira',
  leadership: false,
  direct: true,
  active: true,
  ...over,
});

const missoes = link({
  id: 'DDWMISSI',
  name: 'Squad Missões',
  role: 'Desenvolvedor(a)',
  roles: [{ name: 'Desenvolvedor(a)', leadership: false, origin: 'Convite', primary: true }],
  origin: 'Convite',
  active: false,
});

function setup(over: Partial<React.ComponentProps<typeof LinksSection>> = {}) {
  const onActivate = vi.fn();
  render(
    <LinksSection
      embedded
      links={[link({}), missoes]}
      canSwitch
      switchingTo={null}
      onActivate={onActivate}
      email="a@b.com"
      mustOnboard={false}
      onNavigate={vi.fn()}
      {...over}
    />,
  );
  return { onActivate };
}

describe('LinksSection compacta (ficha)', () => {
  beforeEach(() => h.push.mockClear());

  it('uma linha por vínculo com "CHAVE · Papel · origem"; a ativa tem o selo, a outra o botão', () => {
    const { onActivate } = setup();
    expect(screen.getByText('FLUXOTST · Analista de QA · Jira')).toBeTruthy();
    expect(screen.getByText('DDWMISSI · Desenvolvedor(a) · convite')).toBeTruthy();
    const ativa = screen.getByRole('listitem', { name: 'Squad Fluxo Teste, squad ativa' });
    expect(within(ativa).getByText('Ativa')).toBeTruthy();
    expect(within(ativa).queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tornar Squad Missões a squad ativa' }));
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'DDWMISSI' }));
  });

  it('troca em andamento bloqueia o botão', () => {
    setup({ switchingTo: 'DDWMISSI' });
    expect((screen.getByRole('button', { name: /Tornar Squad Missões/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sem canSwitch não oferece tornar ativa', () => {
    setup({ canSwitch: false });
    expect(screen.queryByRole('button', { name: /Tornar/ })).toBeNull();
  });

  it('mostra a nota e abre "Usar convite" e "Pedir vínculo" ali mesmo', () => {
    setup();
    expect(screen.getByText('A squad e o papel vêm do Jira, de um convite ou de um pedido aprovado por quem lidera.')).toBeTruthy();
    const convite = screen.getByRole('button', { name: /Usar convite/ });
    fireEvent.click(convite);
    expect(convite.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Pedir vínculo/ }));
    expect(screen.getByText('fluxo de pedido')).toBeTruthy();
    fireEvent.click(screen.getByText('fluxo de pedido'));
    expect(screen.getByRole('button', { name: /Pedir vínculo/ })).toBeTruthy();
  });

  it('sem vínculos mostra o estado vazio com a nota', () => {
    setup({ links: [], legacyOnly: true });
    expect(screen.getByText('Você ainda não tem vínculos')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pedir acesso/ })).toBeTruthy();
    expect(screen.getByText(/vêm do Jira, de um convite/)).toBeTruthy();
  });

  it('vínculo de liderança transversal mostra o alcance no lugar do papel e da origem', () => {
    setup({ links: [link({ id: 'DDWPRIME', name: 'Tribo Prime', scope: 'TRIBE', scopeLabel: 'Liderança da tribo', active: false })] });
    expect(screen.getByText('DDWPRIME · Liderança da tribo')).toBeTruthy();
  });
});
