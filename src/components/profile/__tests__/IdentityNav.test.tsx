import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Plug, ShieldCheck } from 'lucide-react';
import { IdentityNav } from '../IdentityNav';

function Harness() {
  const [v, setV] = useState<'jira' | 'security'>('jira');
  return (
    <IdentityNav
      items={[
        { id: 'jira', label: 'Jira', icon: Plug },
        { id: 'security', label: 'Segurança', icon: ShieldCheck },
      ]}
      value={v}
      onChange={setV}
      label="Seções"
      idPrefix="t"
    />
  );
}

describe('IdentityNav', () => {
  it('só uma aba fica selecionada e só ela tem o fundo de marca', () => {
    render(<Harness />);
    const jira = screen.getByRole('tab', { name: 'Jira' });
    const sec = screen.getByRole('tab', { name: 'Segurança' });
    fireEvent.click(sec);
    expect(sec.getAttribute('aria-selected')).toBe('true');
    expect(jira.getAttribute('aria-selected')).toBe('false');
    expect(sec.className).toContain('bg-primary/10');
    expect(jira.className).not.toContain('bg-primary/10');
    expect(jira.className).not.toMatch(/(^|\s)hover:bg-accent/);
  });

  it('as setas movem a seleção', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: 'Segurança' }).getAttribute('aria-selected')).toBe('true');
  });
});
