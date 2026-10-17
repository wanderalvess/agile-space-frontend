import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MyLink } from '../../../lib/my-links';
import { LinkCard } from '../LinkCard';
import { LegacyOnlyNotice, LEGACY_ONLY_MESSAGE } from '../../onboarding/LegacyOnlyNotice';

const base: MyLink = {
  id: 'DDWMISSI',
  name: 'Missão Digital',
  role: 'Product Owner',
  roles: [
    { name: 'Product Owner', leadership: true, origin: 'Manual', primary: true },
    { name: 'Developer', leadership: false, origin: 'Importado do Jira', primary: false },
  ],
  scope: 'SQUAD',
  scopeLabel: null,
  origin: 'Manual',
  leadership: true,
  direct: true,
  tribe: 'Varejo',
  active: false,
};

const noop = () => {};

describe('LinkCard', () => {
  it('mostra TODOS os papéis da squad e a origem de cada um', () => {
    render(<LinkCard link={base} canSwitch switching={false} busy={false} onActivate={noop} />);
    expect(screen.getByText('Product Owner')).toBeTruthy();
    expect(screen.getByText('Developer')).toBeTruthy();
    expect(screen.getByText('Origem: Manual (Product Owner) · Importado do Jira (Developer)')).toBeTruthy();
    expect(screen.getByText('Liderança')).toBeTruthy();
  });

  it('origem igual em todos os papéis aparece uma vez', () => {
    const link = { ...base, roles: base.roles.map((r) => ({ ...r, origin: 'Convite' })) };
    render(<LinkCard link={link} canSwitch switching={false} busy={false} onActivate={noop} />);
    expect(screen.getByText('Origem: Convite')).toBeTruthy();
  });

  it('sem origem conhecida (linha antiga), não mostra origem', () => {
    const link = { ...base, origin: null, roles: base.roles.map((r) => ({ ...r, origin: null })) };
    render(<LinkCard link={link} canSwitch switching={false} busy={false} onActivate={noop} />);
    expect(screen.queryByText(/Origem:/)).toBeNull();
  });

  it('vínculo de tribo é marcado como "Liderança da tribo", sem papel sintético nem origem', () => {
    const link: MyLink = {
      ...base,
      id: 'DDWPRIME',
      name: 'Prime',
      role: 'Liderança Transversal da Tribo',
      roles: [{ name: 'Liderança Transversal da Tribo', leadership: true, origin: null, primary: true }],
      scope: 'TRIBE',
      scopeLabel: 'Liderança da tribo',
      origin: null,
      direct: false,
      via: 'Varejo',
    };
    render(<LinkCard link={link} canSwitch switching={false} busy={false} onActivate={noop} />);
    expect(screen.getByText('Liderança da tribo')).toBeTruthy();
    expect(screen.queryByText('Liderança Transversal da Tribo')).toBeNull();
    expect(screen.getByText('via Varejo')).toBeTruthy();
  });

  it('squad ativa mostra o selo; as outras oferecem "Tornar ativa"', () => {
    const onActivate = vi.fn();
    const { rerender } = render(<LinkCard link={{ ...base, active: true }} canSwitch switching={false} busy={false} onActivate={onActivate} />);
    expect(screen.getByText('Squad ativa')).toBeTruthy();
    rerender(<LinkCard link={base} canSwitch switching={false} busy={false} onActivate={onActivate} />);
    screen.getByRole('button', { name: /Tornar Missão Digital a squad ativa/ }).click();
    expect(onActivate).toHaveBeenCalledWith(base);
  });
});

describe('LegacyOnlyNotice', () => {
  it('diz o que fazer e oferece o botão que leva ao caminho de pedir vínculo', () => {
    const onAction = vi.fn();
    render(<LegacyOnlyNotice onAction={onAction} />);
    expect(screen.getByRole('status').textContent).toContain(LEGACY_ONLY_MESSAGE);
    expect(LEGACY_ONLY_MESSAGE).toBe('Seu acesso ainda não tem vínculo: peça à liderança da squad.');
    screen.getByRole('button', { name: 'Pedir vínculo' }).click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('sem ação, é só o aviso; com dispensa, oferece "Agora não"', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<LegacyOnlyNotice />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<LegacyOnlyNotice onDismiss={onDismiss} />);
    screen.getByRole('button', { name: 'Dispensar aviso' }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
