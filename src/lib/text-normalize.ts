/**
 * Minúsculas, sem acento e sem pontuação: "Revisão de PR" e "revisao de pr" viram o mesmo texto.
 * Serve para comparar e buscar texto livre no navegador (itens parecidos, filtros locais, busca de itens).
 */
export const normalize = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
