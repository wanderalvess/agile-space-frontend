// Trilha DEV/QA/GESTAO/NA: buckets, soma e ordenacao.
// Extraido de assets/js/jiradash.js. ROLES e roleSortKey ficam PRIVADOS ao modulo —
// nada fora daqui os usava.

// --- Person/role utilities (extraídos para remover duplicação entre renderers) ---
const ROLES = ['DEV', 'QA', 'GESTAO', 'NA'];
export const newRoleBuckets = () => ({ DEV: 0, QA: 0, GESTAO: 0, NA: 0 });
// Soma `value` no bucket; valores fora de DEV/QA caem em NA (visível).
export const addToRole = (buckets, role, value) => {
  const key = ROLES.includes(role) ? role : 'NA';
  buckets[key] += value;
};
const roleSortKey = role => ROLES.indexOf(role) + 1 || 99;
export const sortByRoleThenName = (a, b) =>
  roleSortKey(a.role) - roleSortKey(b.role) || a.name.localeCompare(b.name);
