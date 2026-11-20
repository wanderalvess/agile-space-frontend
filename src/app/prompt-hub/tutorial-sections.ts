/** Seções do tutorial "Como criar uma skill". O índice do tutorial e a folha de ajuda do editor usam a mesma lista. */
export const TUTORIAL_SECTIONS = [
  { id: 'o-que-e', label: 'O que é uma skill' },
  { id: 'quando-usar', label: 'Quando criar uma' },
  { id: 'anatomia', label: 'Anatomia de uma skill' },
  { id: 'passo-a-passo', label: 'Passo a passo' },
  { id: 'frontmatter', label: 'Regras do frontmatter' },
  { id: 'description', label: 'Escrevendo a description' },
  { id: 'liberdade', label: 'Grau de liberdade' },
  { id: 'arquivos', label: 'Quando dividir em arquivos' },
  { id: 'workflows', label: 'Workflows e validação' },
  { id: 'antipadroes', label: 'Anti-padrões' },
  { id: 'checklist', label: 'Checklist final' },
  { id: 'onde-instalar', label: 'Onde instalar e subir' },
  { id: 'padroes-empresa', label: 'Padrões da empresa' },
] as const;

/** Modelo mínimo de SKILL.md que o editor insere. */
export const SKILL_TEMPLATE =
  '---\nname: minha-skill\ndescription: Use quando precisar revisar um contrato de API antes de publicar\n---\n\n# Minha skill\n\n## Passos\n- Leia o contrato.\n- Aponte as quebras de compatibilidade.\n';
