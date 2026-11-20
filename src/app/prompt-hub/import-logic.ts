import { validateSkillFrontmatter } from './skillFrontmatter';
import type { PromptItem, PromptType, PromptVisibility } from './types';

/** Quantos itens entram por vez na importação. */
export const MAX_IMPORT_ITEMS = 200;
/** Mesmo limite do servidor para o conteúdo de um item. */
export const MAX_CONTENT_LENGTH = 200000;

export type ImportLevel = 'ok' | 'aviso' | 'erro';

export interface ImportFile {
  /** Caminho relativo à pasta escolhida (ou só o nome do arquivo). */
  path: string;
  text: string;
}

export interface ImportDraft {
  key: string;
  path: string;
  type: Extract<PromptType, 'skill' | 'resource'>;
  title: string;
  description: string;
  content: string;
  tags: string[];
  level: ImportLevel;
  message: string;
  /** Erro impede a importação; aviso não. */
  blocked: boolean;
  selected: boolean;
}

const baseName = (path: string) => path.split(/[/\\]/).pop() ?? path;
const folderOf = (path: string) => {
  const parts = path.split(/[/\\]/);
  return parts.length > 1 ? parts[parts.length - 2] : '';
};

/** Arquivos que a importação considera: qualquer .md (SKILL.md, resto vira recurso). */
export function isImportCandidate(path: string): boolean {
  return /\.md$/i.test(baseName(path));
}

function tagsForSkill(name: string): string[] {
  const tags = new Set<string>(['skill']);
  name
    .toLowerCase()
    .split(/[-_]/)
    .filter(word => word.length > 2)
    .forEach(word => tags.add(word));
  return Array.from(tags);
}

/**
 * Lê os arquivos escolhidos e monta a prévia. SKILL.md (ou .md com cabeçalho name/description) vira
 * skill e passa pela mesma conferência do editor; os demais .md viram recursos. Cada linha diz se
 * está válida, com aviso (importa mesmo assim) ou com erro (não importa).
 */
export function buildDrafts(files: ImportFile[]): ImportDraft[] {
  const drafts: ImportDraft[] = [];
  files
    .filter(file => isImportCandidate(file.path))
    .forEach((file, index) => {
      const name = baseName(file.path);
      const isSkillFile = name.toLowerCase() === 'skill.md';
      const validation = validateSkillFrontmatter(file.text);
      const asSkill = isSkillFile || validation.hasFrontmatter;

      const errors: string[] = [];
      const warnings: string[] = [];
      if (file.text.length > MAX_CONTENT_LENGTH) errors.push('Arquivo maior que 200.000 caracteres.');
      if (!file.text.trim()) errors.push('O arquivo está vazio.');

      let title: string;
      let description: string;
      let tags: string[] = [];
      let type: ImportDraft['type'];

      if (asSkill) {
        type = 'skill';
        if (file.text.trim()) {
          errors.push(...validation.errors);
          warnings.push(...validation.warnings);
        }
        const folder = folderOf(file.path);
        title = (validation.name?.trim() || (isSkillFile && folder ? folder : name.replace(/\.md$/i, '')) || 'Nova skill');
        description = validation.description ?? '';
        tags = tagsForSkill(validation.name?.trim() || title);
      } else {
        type = 'resource';
        title = name.replace(/\.md$/i, '');
        description = '';
        if (file.text.trim()) warnings.push('Sem descrição. Escreva uma para o item ser achado na busca.');
      }

      if (title.length > 255) {
        title = title.slice(0, 255);
        warnings.push('Título com mais de 255 caracteres foi cortado.');
      }

      const level: ImportLevel = errors.length > 0 ? 'erro' : warnings.length > 0 ? 'aviso' : 'ok';
      drafts.push({
        key: `${index}:${file.path}`,
        path: file.path,
        type,
        title,
        description: description.slice(0, 10000),
        content: file.text,
        tags,
        level,
        message: errors[0] ?? warnings[0] ?? (type === 'skill' ? 'Cabeçalho completo' : 'Arquivo de texto'),
        blocked: errors.length > 0,
        selected: errors.length === 0,
      });
    });
  return drafts;
}

export function selectedDrafts(drafts: ImportDraft[]): ImportDraft[] {
  return drafts.filter(draft => draft.selected && !draft.blocked);
}

/** Monta o que o servidor recebe. Cada payload é o mesmo objeto devolvido em `byPayload`, para ligar falhas ao arquivo. */
export function buildPayloads(
  drafts: ImportDraft[],
  visibility: PromptVisibility,
  author: { authorId: string; authorName: string; authorRole: string; authorSquad: string; authorAvatar: string }
) {
  const byPayload = new Map<Partial<PromptItem>, ImportDraft>();
  const payloads = drafts.map(draft => {
    const payload: Partial<PromptItem> = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      content: draft.content,
      type: draft.type,
      visibility,
      status: 'producao',
      impact: 'medio',
      tags: draft.tags,
      useCount: 0,
      forkCount: 0,
      ...author,
    };
    byPayload.set(payload, draft);
    return payload;
  });
  return { payloads, byPayload };
}
