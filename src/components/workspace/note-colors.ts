/**
 * As 5 cores das notas. O valor gravado no servidor é a própria string de classes (`class`): notas antigas
 * continuam casando, por isso o texto das classes não pode mudar.
 */
export interface NoteColor {
  name: 'Amarelo' | 'Azul' | 'Verde' | 'Rosa' | 'Violeta';
  /** Valor gravado em `color` e usado como superfície do cartão (claro e escuro). */
  class: string;
  /** Bolinha do seletor de cor. */
  dot: string;
  /** Pedaço que identifica a cor em notas antigas (que só tinham a classe clara). */
  match: string;
}

export const NOTE_COLORS: NoteColor[] = [
  {
    name: 'Amarelo',
    class: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-800/40 text-amber-950 dark:text-amber-100',
    dot: 'bg-amber-400',
    match: 'amber',
  },
  {
    name: 'Azul',
    class: 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200/70 dark:border-sky-800/40 text-sky-950 dark:text-sky-100',
    dot: 'bg-sky-400',
    match: 'sky',
  },
  {
    name: 'Verde',
    class: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-100',
    dot: 'bg-emerald-400',
    match: 'emerald',
  },
  {
    name: 'Rosa',
    class: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200/70 dark:border-rose-800/40 text-rose-950 dark:text-rose-100',
    dot: 'bg-rose-400',
    match: 'rose',
  },
  {
    name: 'Violeta',
    class: 'bg-violet-50/90 dark:bg-violet-950/40 border-violet-200/70 dark:border-violet-800/40 text-violet-950 dark:text-violet-100',
    dot: 'bg-violet-400',
    match: 'violet',
  },
];

/** Cor da nota a partir do que está gravado (também reconhece as classes antigas, sem `dark:`). */
export function matchNoteColor(stored: string | null | undefined): NoteColor {
  const value = stored || '';
  return NOTE_COLORS.find((c) => value.includes(c.class.split(' ')[0]) || value.includes(c.match)) ?? NOTE_COLORS[0];
}

/** Superfície (classes) e bolinha de uma nota. */
export function noteTone(stored: string | null | undefined): { name: NoteColor['name']; surface: string; dot: string } {
  const c = matchNoteColor(stored);
  return { name: c.name, surface: c.class, dot: c.dot };
}
