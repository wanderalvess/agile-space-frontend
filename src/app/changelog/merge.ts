import type { AppReleaseItem } from '@/services/changelogApi';

/** "v4.4.6" -> [4, 4, 6]; tags fora do padrão vão para o fim. */
function parseTag(tag: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareTagsDesc(a: string, b: string): number {
  const pa = parseTag(a);
  const pb = parseTag(b);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

/**
 * Junta as versões publicadas no backend (editáveis no admin) com as do arquivo versions.json (que o time gera a
 * cada entrega). Na mesma tag, vale a do backend; as que só existem no arquivo entram. Ordem: mais nova primeiro.
 */
export function mergeReleases(remote: AppReleaseItem[], fromFile: AppReleaseItem[]): AppReleaseItem[] {
  const byTag = new Map<string, AppReleaseItem>();
  for (const r of fromFile) byTag.set(r.tag, r);
  for (const r of remote) byTag.set(r.tag, r);
  return [...byTag.values()].sort((a, b) => compareTagsDesc(a.tag, b.tag));
}
