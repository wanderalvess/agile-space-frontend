import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';
import { LEGACY_REDIRECTS } from '../legacy-redirects';
import { hubHref, resolveHubLocation } from '../squad-hub';

const rule = (source: string) => LEGACY_REDIRECTS.find((r) => r.source === source);

describe('redirects das rotas antigas', () => {
  it('/painel vira o Resumo do hub, permanente (308)', () => {
    expect(rule('/painel')).toEqual({ source: '/painel', destination: '/squad?tab=resumo', permanent: true });
  });

  it('/dashboards e tudo que vem depois caem na aba Painéis', () => {
    expect(rule('/dashboards/:path*')?.destination).toBe('/squad?tab=paineis');
  });

  it('/projects vai para a administração', () => {
    expect(rule('/projects')?.destination).toBe('/admin?tab=jira');
  });

  it('todo destino do hub abre a aba que o redirect promete', () => {
    for (const r of LEGACY_REDIRECTS.filter((x) => x.destination.startsWith('/squad?'))) {
      const query = new URL(r.destination, 'http://x').searchParams;
      expect(hubHref(resolveHubLocation(query.get('tab'), query.get('view')).tab)).toBe(r.destination);
    }
  });

  it('o next.config publica exatamente essas regras', async () => {
    expect(await nextConfig.redirects?.()).toEqual(LEGACY_REDIRECTS);
  });

  it('nenhuma regra é permanente sem destino nem laço (origem diferente do destino)', () => {
    for (const r of LEGACY_REDIRECTS) {
      expect(r.destination.startsWith('/')).toBe(true);
      expect(r.destination.split('?')[0]).not.toBe(r.source.split('/:')[0]);
    }
  });
});
