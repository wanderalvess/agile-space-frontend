import { describe, it, expect } from 'vitest';
import { mergeReleases, compareTagsDesc } from '../merge';
import type { AppReleaseItem } from '@/services/changelogApi';

const rel = (tag: string, title = tag): AppReleaseItem => ({ tag, title, description: '', changes: [], type: 'patch' });

describe('mergeReleases', () => {
  it('inclui versões que só existem no arquivo e ordena da mais nova para a mais antiga', () => {
    const remote = [rel('v4.0.0'), rel('v3.117.1')];
    const file = [rel('v4.4.6'), rel('v4.1.0'), rel('v4.0.0', 'do arquivo')];
    const out = mergeReleases(remote, file);
    expect(out.map(r => r.tag)).toEqual(['v4.4.6', 'v4.1.0', 'v4.0.0', 'v3.117.1']);
  });

  it('na mesma tag vence a versão do backend', () => {
    const out = mergeReleases([rel('v4.0.0', 'editada no admin')], [rel('v4.0.0', 'do arquivo')]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('editada no admin');
  });

  it('compara numericamente (v4.10.0 > v4.9.0) e manda tags fora do padrão para o fim', () => {
    expect(compareTagsDesc('v4.10.0', 'v4.9.0')).toBeLessThan(0);
    expect(mergeReleases([rel('sem-versao'), rel('v1.0.0')], []).map(r => r.tag)).toEqual(['v1.0.0', 'sem-versao']);
  });
});
