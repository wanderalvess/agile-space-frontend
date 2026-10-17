import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Megaphone } from 'lucide-react';
import { ModuleGrid } from '../ModuleGrid';
import { MODULE_COUNT, MODULE_GROUPS } from '../modules';
import { Notice } from '../Notice';
import { LiveNow } from '../LiveNow';
import { RitualsSection } from '../RitualsSection';
import { RitualArt } from '../RitualArt';
import { SquadsOverview } from '../SquadsOverview';
import { RITUAL_KEYS, type SquadSummary, type ToolSession } from '../../../hooks/home/types';

const NOW = new Date('2026-10-14T15:00:00');

describe('módulos', () => {
  it('são 12 em 4 grupos, com as rotas de sempre', () => {
    expect(MODULE_COUNT).toBe(12);
    expect(MODULE_GROUPS.map((g) => g.label)).toEqual([
      'Qualidade e ferramentas',
      'Fluxo e entregas',
      'Colaboração e clima',
      'Utilidades e suporte',
    ]);
    const hrefs = MODULE_GROUPS.flatMap((g) => g.items.map((m) => m.href));
    expect(hrefs).toEqual([
      '/jolt', '/devtools', '/qa',
      '/squad?tab=resumo', '/workspace', '/sprint-planner',
      '/health-check', '/brainstorming', '/action-plan',
      '/knowledge/kb', '/prompt-hub', '/support',
    ]);
    expect(MODULE_GROUPS.flatMap((g) => g.items).filter((m) => m.soon).map((m) => m.title)).toEqual(['Planejador']);
  });

  it('nenhum texto cita "engenharia"', () => {
    const text = JSON.stringify(MODULE_GROUPS.map((g) => [g.label, g.items.map((m) => [m.title, m.description])]));
    expect(text.toLowerCase()).not.toContain('engenharia');
  });

  it('a busca esmaece o que não casa e conta os resultados', () => {
    const { rerender } = render(<ModuleGrid query="" />);
    expect(screen.getByText('12 módulos')).toBeTruthy();
    expect(screen.getByText('Em breve')).toBeTruthy();

    rerender(<ModuleGrid query="conhecimento" />);
    expect(screen.getByText('1 encontrado(s)')).toBeTruthy();

    rerender(<ModuleGrid query="zzzz" />);
    expect(screen.getByText('Nenhum módulo encontrado')).toBeTruthy();
  });
});

describe('Notice', () => {
  it('dispensa pelo botão e mostra o link', () => {
    const onDismiss = vi.fn();
    render(<Notice icon={Megaphone} label="Aviso" title="Nova versão" text="Detalhes" action={{ label: 'Saiba mais', href: '/changelog' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getAllByText('Saiba mais').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('link externo abre em nova aba sem opener', () => {
    render(<Notice icon={Megaphone} title="x" action={{ label: 'Ver', href: 'https://exemplo.com' }} onDismiss={() => {}} />);
    const link = screen.getAllByText('Ver')[0].closest('a');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});

describe('Ao vivo agora', () => {
  const session = (over: Partial<ToolSession>): ToolSession => ({
    id: '1', tool: 'poker', squadId: 'phoenix', squadName: 'Phoenix', title: 'Refinamento Sprint 42',
    createdAt: NOW.toISOString(), participants: 7, status: 'live', href: '/room/1', ...over,
  });

  it('com sessões: cards com "Entrar" e a tag da squad só para quem tem várias', () => {
    const { rerender } = render(<LiveNow sessions={[session({})]} showSquad={false} upcoming={[]} now={NOW} />);
    expect(screen.getByText('Refinamento Sprint 42')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.queryByText('Phoenix')).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/room/1');

    rerender(<LiveNow sessions={[session({})]} showSquad upcoming={[]} now={NOW} />);
    expect(screen.getByText('Phoenix')).toBeTruthy();
  });

  it('sala aguardando o início aparece com o rótulo "Aguardando"; a que está rolando, "Ao vivo"', () => {
    render(
      <LiveNow
        sessions={[session({}), session({ id: '2', title: 'Refinamento novo', status: 'planning', participants: 1, href: '/room/2' })]}
        showSquad={false}
        upcoming={[]}
        now={NOW}
      />,
    );
    expect(screen.getByText('Ao vivo')).toBeTruthy();
    expect(screen.getByText('Aguardando')).toBeTruthy();
    expect(screen.getByText('Refinamento novo')).toBeTruthy();
    expect(screen.getAllByText('Entrar')).toHaveLength(2);
  });

  it('sem sessões: estado vazio com as próximas cerimônias e o atalho', () => {
    render(
      <LiveNow
        sessions={[]}
        showSquad={false}
        upcoming={[{ title: 'Refinamento', start: new Date('2026-10-15T10:00:00') }]}
        now={NOW}
      />,
    );
    expect(screen.getByText('Nenhuma sessão acontecendo agora')).toBeTruthy();
    expect(screen.getByText(/Refinamento · /)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Preparar o refinamento' }).getAttribute('href')).toBe('/room?nova=1');
  });

  it('falha: aviso com "Tentar de novo"; durante a nova busca o botão fica ocupado', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<LiveNow sessions={[]} showSquad={false} upcoming={[]} failed onRetry={onRetry} now={NOW} />);
    expect(screen.getByText('Não foi possível carregar as sessões')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<LiveNow sessions={[]} showSquad={false} upcoming={[]} failed loading onRetry={onRetry} now={NOW} />);
    const busy = screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
  });

  it('sem sessões e sem cerimônias: só a mensagem', () => {
    render(<LiveNow sessions={[]} showSquad={false} upcoming={[]} now={NOW} />);
    expect(screen.queryByText(/Próximas cerimônias/)).toBeNull();
  });
});

describe('RitualsSection: histórico indisponível', () => {
  const empty = { poker: [], retro: [], showcase: [], health: [], brainstorming: [] };

  it('mostra o aviso com "Tentar de novo" só quando a busca falhou', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<RitualsSection history={empty} loading={false} showSquad={false} scopeLabel="Squad X" now={NOW} onRetry={onRetry} />);
    expect(screen.queryByText('Histórico indisponível agora.')).toBeNull();

    rerender(<RitualsSection history={empty} loading={false} failed showSquad={false} scopeLabel="Squad X" now={NOW} onRetry={onRetry} />);
    expect(screen.getByText('Histórico indisponível agora.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<RitualsSection history={empty} loading failed showSquad={false} scopeLabel="Squad X" now={NOW} onRetry={onRetry} />);
    expect((screen.getByRole('button', { name: 'Tentar de novo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Miniaturas dos rituais', () => {
  it.each(RITUAL_KEYS)('%s: decorativa e contida na própria área (nada escapa do cartão)', (key) => {
    const { container } = render(<RitualArt ritual={key} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('overflow-hidden');
  });

  it('retro: três colunas lado a lado, sem peças translúcidas empilhadas', () => {
    render(<RitualArt ritual="retro" />);
    ['Bom', 'Melhorar', 'Ação'].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    expect(document.querySelectorAll('.absolute').length).toBe(0);
  });
});

describe('Suas squads', () => {
  const squads: SquadSummary[] = [
    { id: 'phoenix', name: 'Phoenix', isActive: true, sprintName: 'Sprint 42', sprintPercent: 58, daysLeft: 6 },
    { id: 'atlas', name: 'Atlas', isActive: false, sprintPercent: null, daysLeft: null },
  ];

  it('mostra progresso e ao vivo; clicar escolhe e clicar de novo limpa', () => {
    const onPick = vi.fn();
    const { rerender } = render(<SquadsOverview squads={squads} scope={null} liveBySquad={{ phoenix: 2 }} switchingTo={null} now={NOW} onPick={onPick} />);
    expect(screen.getByText('2 ao vivo')).toBeTruthy();
    expect(screen.getByText('Sprint 42 · faltam 6 dias')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Phoenix/ }).getAttribute('aria-valuenow')).toBe('58');
    expect(screen.getByText('Sem sprint sincronizada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }));
    expect(onPick).toHaveBeenLastCalledWith('atlas');

    rerender(<SquadsOverview squads={squads} scope="atlas" liveBySquad={{}} switchingTo={null} now={NOW} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }));
    expect(onPick).toHaveBeenLastCalledWith(null);
  });
});
