import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (href: string) => redirect(href) }));

import { LEGACY_ROUTES, legacyRedirectHref } from '../../../lib/devtools/registry';

async function destino(load: () => Promise<{ default: () => unknown }>): Promise<string> {
  const mod = await load();
  try {
    mod.default();
  } catch (e) {
    return String((e as Error).message).replace('NEXT_REDIRECT:', '');
  }
  throw new Error('a página não redirecionou');
}

beforeEach(() => {
  redirect.mockClear();
});

describe('rotas antigas do DevTools e /qa redirecionam de verdade', () => {
  const pages: Record<string, () => Promise<{ default: () => unknown }>> = {
    json: () => import('../json/page'),
    xml: () => import('../xml/page'),
    'yaml-converter': () => import('../yaml-converter/page'),
    'sql-formatter': () => import('../sql-formatter/page'),
    'json-schema': () => import('../json-schema/page'),
    base64: () => import('../base64/page'),
    'url-encoder': () => import('../url-encoder/page'),
    'deep-decoder': () => import('../deep-decoder/page'),
    'api-diff': () => import('../api-diff/page'),
    'doc-generator': () => import('../doc-generator/page'),
    mocks: () => import('../mocks/page'),
  };

  it('cobre todas as rotas antigas do registro', () => {
    expect(Object.keys(pages).sort()).toEqual(Object.keys(LEGACY_ROUTES).sort());
  });

  for (const slug of Object.keys(pages)) {
    it(`/devtools/${slug}`, async () => {
      expect(await destino(pages[slug])).toBe(legacyRedirectHref(slug));
    });
  }

  it('/qa vai para o filtro Qualidade do DevTools', async () => {
    expect(await destino(() => import('../../qa/page'))).toBe('/devtools?grupo=qualidade');
  });
});
