/**
 * Validação do formato SKILL.md conforme a especificação de Agent Skills.
 *
 * Regras duras (bloqueiam a publicação) vêm da spec: `name` até 64 caracteres,
 * apenas minúsculas/números/hífens, sem palavras reservadas; `description`
 * obrigatória e até 1024 caracteres; nenhum dos dois aceita tags XML.
 *
 * Avisos (não bloqueiam) são heurísticas das boas práticas: description que não
 * diz quando usar, texto em primeira pessoa e corpo acima de 500 linhas.
 */

export interface SkillValidation {
  /** Há um bloco de frontmatter delimitado por --- no início do arquivo. */
  hasFrontmatter: boolean;
  name?: string;
  description?: string;
  /** Impedem a publicação. */
  errors: string[];
  /** Sinalizam risco de a skill não ser acionada, mas não impedem. */
  warnings: string[];
}

const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const BODY_MAX_LINES = 500;
const RESERVED_WORDS = ['anthropic', 'claude'];

/** Captura o bloco entre o primeiro par de --- no topo do arquivo. */
const FRONTMATTER_RE = /^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

const XML_TAG_RE = /<[^>]+>/;

/** Lê `chave: valor` de uma linha de topo do frontmatter (sem YAML aninhado). */
const readField = (block: string, field: string): string | undefined => {
  const match = block.match(new RegExp(`^${field}\\s*:\\s*(.*)$`, 'mi'));
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, '');
};

export function validateSkillFrontmatter(content?: string): SkillValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = content?.trim();

  if (!raw) {
    return {
      hasFrontmatter: false,
      errors: ['O conteúdo do SKILL.md está vazio.'],
      warnings
    };
  }

  const match = raw.match(FRONTMATTER_RE);

  if (!match) {
    return {
      hasFrontmatter: false,
      errors: [
        'Falta o frontmatter. O arquivo precisa começar com --- , conter name e description, e fechar com --- .'
      ],
      warnings
    };
  }

  const [, block, body = ''] = match;
  const name = readField(block, 'name');
  const description = readField(block, 'description');

  // name
  if (!name) {
    errors.push('O campo name é obrigatório no frontmatter.');
  } else {
    if (name.length > NAME_MAX) {
      errors.push(`O name tem ${name.length} caracteres; o limite é ${NAME_MAX}.`);
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push('O name aceita apenas letras minúsculas, números e hífens.');
    }
    if (XML_TAG_RE.test(name)) {
      errors.push('O name não pode conter tags XML.');
    }
    const reserved = RESERVED_WORDS.find(word => name.toLowerCase().includes(word));
    if (reserved) {
      errors.push(`O name não pode conter a palavra reservada "${reserved}".`);
    }
  }

  // description
  if (!description) {
    errors.push('O campo description é obrigatório no frontmatter.');
  } else {
    if (description.length > DESCRIPTION_MAX) {
      errors.push(
        `A description tem ${description.length} caracteres; o limite é ${DESCRIPTION_MAX}.`
      );
    }
    if (XML_TAG_RE.test(description)) {
      errors.push('A description não pode conter tags XML.');
    }

    // Heurísticas de qualidade — é a description que decide se a skill é acionada.
    if (!/\b(use|usar|utilize)\b/i.test(description)) {
      warnings.push(
        'A description não diz quando usar a skill. Acrescente algo como "Use quando...".'
      );
    }
    if (/\b(eu|meu|minha|posso|consigo)\b/i.test(description)) {
      warnings.push(
        'A description parece estar em primeira pessoa. A especificação pede terceira pessoa (ex: "Revisa pull requests...").'
      );
    }
    if (description.length < 40) {
      warnings.push('A description está muito curta para diferenciar esta skill das outras.');
    }
  }

  // corpo
  const bodyLines = body.trim() ? body.trim().split(/\r?\n/).length : 0;
  if (bodyLines === 0) {
    warnings.push('O corpo do SKILL.md está vazio — não há instruções depois do frontmatter.');
  } else if (bodyLines > BODY_MAX_LINES) {
    warnings.push(
      `O corpo tem ${bodyLines} linhas. Acima de ${BODY_MAX_LINES}, divida em arquivos de referência.`
    );
  }

  return { hasFrontmatter: true, name, description, errors, warnings };
}
