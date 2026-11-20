import { toSafeExternalUrl } from '@/lib/utils';
import { getTypeMeta } from './constants';
import { validateSkillFrontmatter } from './skillFrontmatter';
import type { PromptItem } from './types';

/** Limites iguais aos do servidor (colunas varchar(255), conteúdo até 200 mil caracteres). */
export const LIMITS = {
  title: 255,
  description: 10000,
  content: 200000,
  short: 255,
  tag: 100,
  maxTags: 30,
};

export const SUGGESTED_TAGS = ['jira', 'scrum', 'qualidade', 'api', 'suporte', 'git', 'testes', 'escrita', 'refinamento', 'documentacao'];

export type EditorForm = Partial<PromptItem>;

export const EMPTY_FORM: EditorForm = {
  title: '',
  content: '',
  description: '',
  gemLink: '',
  type: 'prompt',
  visibility: 'private',
  tags: [],
  status: 'producao',
  impact: 'medio',
  businessGoal: '',
  targetAudience: '',
  architectureLink: '',
};

/** Etiqueta em minúsculas, sem "#", com no máximo 100 caracteres. */
export const normalizeTag = (tag: string): string => tag.trim().replace(/#/g, '').toLowerCase().slice(0, LIMITS.tag);

export type BuildResult =
  | { ok: true; payload: EditorForm }
  | { ok: false; title: string; description?: string };

/** Por que ainda não dá para publicar (mostrado na faixa do topo). Vazio quando está tudo certo. */
export function publishBlock(form: EditorForm): string {
  const meta = getTypeMeta(form.type);
  if (!form.title?.trim()) return 'Escreva um título para poder publicar.';
  if (form.type === 'skill' && form.content?.trim()) {
    const errors = validateSkillFrontmatter(form.content).errors.length;
    if (errors > 0) return `Corrija ${errors === 1 ? '1 erro' : `${errors} erros`} do SKILL.md para poder publicar.`;
  }
  if (!form.content?.trim() && !form.gemLink?.trim()) {
    return meta.linkFirst ? 'Informe o link da ferramenta para poder publicar.' : `Preencha o campo "${meta.contentLabel}" para poder publicar.`;
  }
  return '';
}

/**
 * Confere o formulário e monta o que vai para o servidor: etiqueta digitada e não confirmada entra,
 * o link da ferramenta some nos tipos que não o usam, e os links são normalizados para http(s).
 */
export function buildPayload(form: EditorForm, tagInput: string): BuildResult {
  const meta = getTypeMeta(form.type);

  if (!form.title?.trim()) {
    return { ok: false, title: 'Dê um título ao item', description: 'É por ele que as pessoas vão encontrar o que você publicou.' };
  }

  const hasContent = !!form.content?.trim();
  const hasLink = !!form.gemLink?.trim();
  if (!hasContent && !hasLink) {
    return {
      ok: false,
      title: 'Falta o conteúdo',
      description: meta.linkFirst ? 'Informe o link da ferramenta ou descreva a configuração.' : `Preencha o campo "${meta.contentLabel}".`,
    };
  }

  // Skill fora do formato não é publicada: um SKILL.md inválido nunca é carregado pelo assistente.
  if (form.type === 'skill' && hasContent) {
    const check = validateSkillFrontmatter(form.content);
    if (check.errors.length > 0) return { ok: false, title: 'O SKILL.md ainda não está no formato', description: check.errors[0] };
  }

  const payload: EditorForm = { ...form };

  const pending = normalizeTag(tagInput);
  if (pending && !payload.tags?.includes(pending)) {
    if ((payload.tags?.length ?? 0) >= LIMITS.maxTags) return { ok: false, title: `Use no máximo ${LIMITS.maxTags} etiquetas` };
    payload.tags = [...(payload.tags ?? []), pending];
  }

  // O link da ferramenta só existe na tela de alguns tipos; um valor antigo escondido não pode travar o envio.
  if (!meta.linkFirst) payload.gemLink = '';

  const links: Array<['gemLink' | 'architectureLink', string]> = [['architectureLink', 'Link de documentação']];
  if (meta.linkFirst) links.unshift(['gemLink', 'Link da ferramenta']);
  for (const [field, label] of links) {
    const raw = form[field]?.trim();
    if (!raw) continue;
    const safe = toSafeExternalUrl(raw);
    if (!safe) return { ok: false, title: `${label} inválido`, description: 'Use um endereço http:// ou https://.' };
    payload[field] = safe;
  }

  // Campos só do servidor para quem vê: não voltam no envio.
  delete payload.favorite;
  delete payload.canEdit;
  delete payload.canModerate;

  return { ok: true, payload };
}
