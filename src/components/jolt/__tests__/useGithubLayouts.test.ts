import { describe, expect, it } from 'vitest';
import { isValidRepoName } from '../useGithubLayouts';

describe('isValidRepoName', () => {
  it('aceita usuário/repositório do GitHub', () => {
    expect(isValidRepoName('totvs/winthor-smart-hub-layouts')).toBe(true);
    expect(isValidRepoName('a.b_c/d-e.f')).toBe(true);
  });

  it('recusa caminhos, parâmetros e travessia que mudariam a URL consultada', () => {
    expect(isValidRepoName('totvs')).toBe(false);
    expect(isValidRepoName('totvs/repo/extra')).toBe(false);
    expect(isValidRepoName('../users/octocat')).toBe(false);
    expect(isValidRepoName('totvs/repo?per_page=1')).toBe(false);
    expect(isValidRepoName('totvs/repo#x')).toBe(false);
    expect(isValidRepoName('')).toBe(false);
  });
});
